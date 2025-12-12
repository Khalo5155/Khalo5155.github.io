// 全局变量定义（新增 sceneContainer 和物料列表相关变量）
let scene, camera, renderer, raycaster, mouse, orbitControls;
let transparentBox, allModels = [];
const OBJECT_DIR = './Objects/';
const BOX_SIZE = 1000;
let sceneContainer;
let materialListElement; // 物料列表容器
let modelNameMap = new Map(); // 模型与名称的映射关系
let highlightPenetrateMaterial; // 穿透遮挡物的高亮材质
let selectedModel = null; // 当前选中的模型

// 动画相关全局变量
let modelAnimData = [];
let animationProgress = 0;
let isAnimating = false;

// 初始化场景
function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // 创建场景容器，所有可视元素都添加到这个容器中
    sceneContainer = new THREE.Group();
    loadAllObjFromDir(OBJECT_DIR);
    createTransparentBox();
    scene.add(sceneContainer);
    sceneContainer.rotation.x = -Math.PI / 2;

    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        10000
    );
    camera.position.set(300, 300, 300);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    document.getElementById('container').appendChild(renderer.domElement);

    // 初始化物料列表
    materialListElement = document.getElementById('material-list');

    addLights();
    initRaycaster();
    initOrbitControls();
    initAnimationControl();
    window.addEventListener('resize', onWindowResize);

    // 初始化穿透高亮材质
    highlightPenetrateMaterial = new THREE.MeshBasicMaterial({
        color: 0xaaaaff,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthTest: false // 穿透遮挡物显示
    });

    animate();
}

// 创建透明盒子
function createTransparentBox() {
    const radius = 1500 / 2;
    const height = 1900;
    const radialSegments = 64;
    const geometry = new THREE.CylinderGeometry(
        radius, radius, height, radialSegments, 1, true
    );

    const material = new THREE.MeshBasicMaterial({
        color: 0x0099ff,
        transparent: true,
        opacity: 0.08,
        wireframe: false,
        side: THREE.DoubleSide
    });

    transparentBox = new THREE.Mesh(geometry, material);
    transparentBox.rotation.x = Math.PI / 2;

    const targetWorldPos = new THREE.Vector3(0, 0, 0);
    transparentBox.parent = sceneContainer;
    transparentBox.worldToLocal(targetWorldPos);
    transparentBox.position.copy(targetWorldPos);

    sceneContainer.add(transparentBox);
}

// 自动调整相机
function autoAdjustCamera() {
    if (allModels.length === 0) return;

    const boundingBox = new THREE.Box3();
    allModels.forEach((model) => {
        const modelBox = new THREE.Box3().setFromObject(model);
        boundingBox.union(modelBox);
    });

    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    const maxSize = Math.max(...size.toArray());
    const diagonal = Math.sqrt(size.x * size.x + size.y * size.y + size.z * size.z);

    const fov = camera.fov * Math.PI / 180;
    const distance = (diagonal / 2) / Math.tan(fov / 2) * 1.8;

    camera.position.set(
        center.x,
        center.y + distance * 1.0,
        center.z + distance * 0.8
    );

    camera.lookAt(center);
    camera.rotation.z = Math.PI / 2;

    orbitControls.target.copy(center);
    orbitControls.update();

    const boxpos = new THREE.Vector3(0, 120, 1900+230);
    boxpos.add(center);
    transparentBox.position.copy(boxpos);
}

// 根据文件名解析形状并返回对应颜色
function getColorByFileName(fileName) {
    const baseName = fileName.replace(/\.[a-zA-Z0-9]+$/, '').trim();
    
    if (/^D\d+(\.\d+)?_d\d+(\.\d+)?_\d+(\.\d+)?$/.test(baseName)) {
        return new THREE.Color(0x00ff00);
    }
    else if (/^D\d+(\.\d+)?_\d+(\.\d+)?$/.test(baseName)) {
        return new THREE.Color(0xff0000);
    }
    else if (/^M\d+(\.\d+)?_\d+(\.\d+)?$/.test(baseName)) {
        return new THREE.Color(0xffff00);
    }
    else if (/^\d+(\.\d+)?_\d+(\.\d+)?_\d+(\.\d+)?$/.test(baseName)) {
        return new THREE.Color(0x0000ff);
    }
    return new THREE.Color(0xaaaaaa);
}

// 添加增强光源
function addLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight1.position.set(500, 800, 600);
    directionalLight1.castShadow = true;
    
    directionalLight1.shadow.mapSize.width = 2048;
    directionalLight1.shadow.mapSize.height = 2048;
    directionalLight1.shadow.camera.near = 10;
    directionalLight1.shadow.camera.far = 2000;
    directionalLight1.shadow.camera.left = -1000;
    directionalLight1.shadow.camera.right = 1000;
    directionalLight1.shadow.camera.top = 1000;
    directionalLight1.shadow.camera.bottom = -1000;
    directionalLight1.shadow.radius = 2;
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xe0e0ff, 0.6);
    directionalLight2.position.set(-400, 300, -300);
    directionalLight2.castShadow = false;
    scene.add(directionalLight2);

    const directionalLight3 = new THREE.DirectionalLight(0xffffe0, 0.3);
    directionalLight3.position.set(0, -500, 0);
    directionalLight3.castShadow = false;
    scene.add(directionalLight3);
}

// 初始化动画控制（滑动条）
function initAnimationControl() {
    const slider = document.getElementById('animation-slider');
    const progressText = document.getElementById('animation-progress');
    const controlPanel = document.getElementById('animation-control');

    slider.addEventListener('input', (e) => {
        animationProgress = parseInt(e.target.value) / 100;
        progressText.textContent = `${animationProgress.toFixed(2)}%`;
        
        isAnimating = animationProgress > 0;
        updateAnimationByProgress();
    });

    window.addEventListener('modelsLoaded', () => {
        controlPanel.style.display = 'flex';
    });
}

// 根据滑动条进度更新动画
function updateAnimationByProgress() {
    if (modelAnimData.length === 0) return;

    const totalStages = modelAnimData.length;
    const stageProgress = animationProgress / 100 * totalStages;

    modelAnimData.forEach((data, index) => {
        const model = data.model;
        const startProgress = index;
        const endProgress = index + 1;

        if (stageProgress < startProgress) {
            model.position.copy(data.startPos);
            resetModelHighlight(model);
            resetListHighlight(model);
        } else if (stageProgress <= endProgress) {
            const fallProgress = Math.min(1, (stageProgress - startProgress));
            const easeProgress = 1 - Math.pow(1 - fallProgress, 3);
            model.position.lerpVectors(data.startPos, data.targetPos, easeProgress);
            setModelHighlight(model, true);
            setListHighlight(model, true);
        } else {
            model.position.copy(data.targetPos);
            resetModelHighlight(model);
            resetListHighlight(model);
        }
    });
}

// 创建物料列表
function createMaterialList() {
    materialListElement.innerHTML = '';
    modelNameMap.clear();
    
    allModels.forEach((model, index) => {
        // 获取模型文件名作为显示名称
        const fileName = model.userData.fileName || `模型 ${index + 1}`;
        const baseName = fileName.replace(/\.[a-zA-Z0-9]+$/, '').trim();
        
        // 创建列表项
        const listItem = document.createElement('div');
        listItem.className = 'material-item';
        listItem.textContent = baseName;
        listItem.dataset.index = index;
        
        // 存储模型与列表项的映射关系
        modelNameMap.set(model, listItem);
        modelNameMap.set(listItem, model);
        
        // 列表项鼠标事件
        listItem.addEventListener('mouseenter', () => {
            // if (isAnimating) return;
            const model = modelNameMap.get(listItem);
            // 使用穿透高亮材质
            setModelListHighlight(model, true);
            setListHighlight(model, true);
        });

        listItem.addEventListener('mouseleave', () => {
            // if (isAnimating) return;
            const model = modelNameMap.get(listItem);
            // 重置为原始材质
            if (model != selectedModel){
                setModelListHighlight(model, false);
                setListHighlight(model, false);
            }
        });

        listItem.addEventListener('click', () => {
            const model = modelNameMap.get(listItem);
            // 取消之前选中模型的高亮
            if (selectedModel) {
                resetModelHighlight(selectedModel);
                resetListHighlight(selectedModel);
            }
            // 设置新选中模型的高亮
            if (selectedModel !== model) {
                selectedModel = model;
                setModelListHighlight(selectedModel, true);
                setListHighlight(selectedModel, true);
            } else {
                selectedModel = null;
            }
        });
        
        materialListElement.appendChild(listItem);
    });
    
    materialListElement.style.display = 'block';
}

// 确保列表项可见
function ensureListItemVisible(model) {
    const listItem = modelNameMap.get(model);
    if (!listItem) return;
    
    const listRect = materialListElement.getBoundingClientRect();
    const itemRect = listItem.getBoundingClientRect();
    
    // 检查列表项是否在可视区域内
    if (itemRect.top < listRect.top || itemRect.bottom > listRect.bottom) {
        // 滚动到列表项位置
        listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// 初始化模型动画数据
function initModelAnimationData() {
    modelAnimData = [];
    allModels.forEach((model) => {
        const boundingBox = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);
        const centerZ = center.y;
        
        modelAnimData.push({
            model: model,
            targetPos: new THREE.Vector3(0, 0, 0),
            startPos: new THREE.Vector3(0, 0, 1500),
            centerZ: centerZ
        });
    });
    
    modelAnimData.sort((a, b) => a.centerZ - b.centerZ);
    modelAnimData.forEach((data) => data.model.position.copy(data.startPos));
}

// 加载目录下所有 OBJ 文件
async function loadAllObjFromDir(dirPath) {
    try {
        const validDirPath = dirPath.endsWith('/') ? dirPath : dirPath + '/';
        const response = await fetch(validDirPath);
        
        if (!response.ok) {
            const errorMsg = `目录访问失败，状态码：${response.status}（路径：${validDirPath}）`;
            throw new Error(errorMsg);
        }

        const html = await response.text();
        const objFilePaths = parseObjPathsFromDirHTML(html, validDirPath);

        if (objFilePaths.length === 0) {
            document.getElementById('loading').textContent = 'Object 目录下未找到 OBJ 文件';
            return;
        }

        const loadingElem = document.getElementById('loading');
        loadingElem.textContent = `加载模型中...（共 ${objFilePaths.length} 个，已加载 0 个）`;

        let loadedCount = 0;
        let failedCount = 0;
        const loader = new THREE.OBJLoader();

        objFilePaths.forEach((filePath, index) => {
            loader.load(
                filePath,
                (object) => {
                    object.castShadow = true;
                    object.receiveShadow = true;
                    
                    // 存储文件名到模型的userData中
                    const fileName = filePath.split('/').pop();
                    object.userData.fileName = fileName;

                    object.traverse((child) => {
                        if (child.isMesh) {
                            const shapeColor = getColorByFileName(fileName);
                            
                            child.material = new THREE.MeshStandardMaterial({
                                color: shapeColor,
                                metalness: 0.2,
                                roughness: 0.7,
                                reflectivity: 0.3,
                                shininess: 80,
                                side: THREE.DoubleSide
                            });
                            
                            child.castShadow = true;
                            child.receiveShadow = true;
                            
                            child.userData.originalMaterial = child.material;
                            const hueVariation = (Math.random() - 0.5) * 0.1;
                            child.material.color.offsetHSL(hueVariation, 0, 0);
                        }
                    });

                    sceneContainer.add(object);
                    allModels.push(object);

                    loadedCount++;
                    
                    if (loadedCount + failedCount < objFilePaths.length) {
                        loadingElem.textContent = `加载模型中...（共 ${objFilePaths.length} 个，已加载 ${loadedCount} 个，失败 ${failedCount} 个）`;
                    } else {
                        loadingElem.style.display = 'none';
                        document.getElementById('info').style.display = 'block';
                        
                        if (loadedCount > 0) {
                            autoAdjustCamera();
                            initModelAnimationData();
                            createMaterialList(); // 模型加载完成后创建物料列表
                            window.dispatchEvent(new Event('modelsLoaded'));
                        }

                        if (failedCount === 0) {
                            console.log(`所有 ${objFilePaths.length} 个模型加载成功！`);
                        } else {
                            console.warn(`模型加载完成：成功 ${loadedCount} 个，失败 ${failedCount} 个`);
                        }
                    }
                },
                (xhr) => {
                    const progress = Math.round((xhr.loaded / xhr.total) * 100);
                },
                (error) => {
                    const errorMsg = `模型 ${index + 1} 加载失败：${error.message}`;
                    console.error(errorMsg, '路径：', filePath);
                    
                    failedCount++;
                    
                    if (loadedCount + failedCount < objFilePaths.length) {
                        loadingElem.textContent = `加载模型中...（共 ${objFilePaths.length} 个，已加载 ${loadedCount} 个，失败 ${failedCount} 个）`;
                    } else {
                        loadingElem.style.display = 'none';
                        document.getElementById('info').style.display = 'block';
                        
                        if (loadedCount > 0) {
                            autoAdjustCamera();
                            initModelAnimationData();
                            createMaterialList();
                            window.dispatchEvent(new Event('modelsLoaded'));
                        }
                    }
                }
            );
        });
    } catch (error) {
        console.error('目录读取失败：', error.message);
        document.getElementById('loading').textContent = `目录访问失败：${error.message}`;
    }
}

// 解析目录 HTML
function parseObjPathsFromDirHTML(html, baseDir) {
    const objPaths = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const linkElements = doc.querySelectorAll('li a');
    linkElements.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.endsWith('.obj')) {
            try {
                const baseUrl = baseDir.startsWith('http') ? new URL(baseDir) : new URL(baseDir, window.location.origin);
                const fullUrl = new URL(href, baseUrl);
                objPaths.push(fullUrl.href);
            } catch (e) {
                const fullPath = baseDir.endsWith('/') ? baseDir + href : baseDir + '/' + href;
                objPaths.push(fullPath);
                console.warn('路径解析降级处理：', fullPath, e.message);
            }
        }
    });

    if (objPaths.length === 0) {
        const regex = /<a\s+href="([^"]+\.obj)"[^>]*>/gi;
        let match;
        while ((match = regex.exec(html)) !== null) {
            try {
                const baseUrl = baseDir.startsWith('http') ? new URL(baseDir) : new URL(baseDir, window.location.origin);
                const fullUrl = new URL(match[1], baseUrl);
                objPaths.push(fullUrl.href);
                console.log('正则解析到OBJ文件路径：', fullUrl.href);
            } catch (e) {
                const fullPath = baseDir.endsWith('/') ? baseDir + match[1] : baseDir + '/' + match[1];
                objPaths.push(fullPath);
                console.warn('正则路径解析降级处理：', fullPath, e.message);
            }
        }
    }

    return objPaths;
}

// 初始化射线检测
function initRaycaster() {
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    const canvas = renderer.domElement;
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
    // 添加点击事件
    canvas.addEventListener('click', onMouseClick);
}

// 初始化轨道控制器
function initOrbitControls() {
    orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControls.screenSpacePanning = true;
    
    orbitControls.minDistance = 10;
    orbitControls.maxDistance = 10000;
    
    orbitControls.maxPolarAngle = Math.PI / 1.3;
    orbitControls.minPolarAngle = -Math.PI / 1.3;
}

// 鼠标移动事件（高亮逻辑）
function onMouseMove(event) {
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();

    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    camera.updateProjectionMatrix();
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(allModels, true);
    const hoveredModel = intersects.length > 0 ? getTopLevelModel(intersects[0].object) : null;

    // 重置所有高亮
    allModels.forEach(model => {
        // 如果是选中的模型则不重置
        if (model !== selectedModel) {
            resetModelHighlight(model);
            resetListHighlight(model);
        }
    });

    // 高亮当前选中的模型和列表项
    if (hoveredModel && hoveredModel !== selectedModel) {
        setModelHighlight(hoveredModel, true);
        setListHighlight(hoveredModel, true);
    }
}

// 鼠标离开事件
function onMouseLeave() {
    // if (isAnimating) return;

    allModels.forEach((model) => {
        // 保留选中模型的高亮
        if (model !== selectedModel) {
            resetModelHighlight(model);
            resetListHighlight(model);
        }
    });
}

// 添加点击事件处理函数
function onMouseClick() {
    // if (isAnimating) return;

    camera.updateProjectionMatrix();
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(allModels, true);
    const clickedModel = intersects.length > 0 ? getTopLevelModel(intersects[0].object) : null;

    if (clickedModel) {
        ensureListItemVisible(clickedModel);
        
        // 处理选中状态
        if (selectedModel) {
            resetModelHighlight(selectedModel);
            resetListHighlight(selectedModel);
        }
        if (selectedModel !== clickedModel) {
            selectedModel = clickedModel;
            setModelListHighlight(selectedModel, true);
            setListHighlight(selectedModel, true);
        } else {
            selectedModel = null;
        }
    }
}

// 设置模型高亮（动画用）
function setModelHighlight(model, isHighlight) {
    model.traverse((child) => {
        if (child.isMesh && child.userData.originalMaterial) {
            if (isHighlight) {
                child.material = new THREE.MeshPhongMaterial({
                    color: 0xffff00,
                    emissive: 0xffff00,
                    emissiveIntensity: 1.5,
                    shininess: 100,
                    transparent: child.userData.originalMaterial.transparent || false,
                    opacity: child.userData.originalMaterial.opacity || 1.0
                });
            } else {
                child.material = child.userData.originalMaterial;
            }
        }
    });
}

// 重置模型高亮
function resetModelHighlight(model) {
    setModelHighlight(model, false);
}

// 设置列表项高亮
function setListHighlight(model, isHighlight) {
    const listItem = modelNameMap.get(model);
    if (listItem) {
        if (isHighlight) {
            listItem.classList.add('highlighted');
        } else {
            listItem.classList.remove('highlighted');
        }
    }
}

// 重置列表项高亮
function resetListHighlight(model) {
    setListHighlight(model, false);
}

// 添加列表项鼠标悬停时的模型高亮函数，穿透显示
function setModelListHighlight(model, isHighlight) {
    model.traverse((child) => {
        if (child.isMesh && child.userData.originalMaterial) {
            if (isHighlight) {
                // 保存当前材质用于恢复
                child.userData.tempMaterial = child.material;
                child.material = highlightPenetrateMaterial;
            } else {
                // 恢复原始材质
                if (child.userData.tempMaterial) {
                    child.material = child.userData.tempMaterial;
                    delete child.userData.tempMaterial;
                } else {
                    child.material = child.userData.originalMaterial;
                }
            }
        }
    });
}

// 获取顶层模型
function getTopLevelModel(child) {
    let current = child;
    while (current.parent) {
        if (allModels.includes(current)) {
            return current;
        }
        current = current.parent;
    }
    return allModels.includes(current) ? current : null;
}

// 窗口大小调整
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    orbitControls.update();
}

// 渲染循环
function animate() {
    requestAnimationFrame(animate);
    orbitControls.update();
    renderer.render(scene, camera);
}

// 启动应用
window.addEventListener('load', initScene);
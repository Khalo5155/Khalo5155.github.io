// 全局变量定义（新增 sceneContainer）
let scene, camera, renderer, raycaster, mouse, orbitControls;
let transparentBox, allModels = [];
const OBJECT_DIR = './Objects/';
const BOX_SIZE = 1000;
let sceneContainer; // 新增：场景容器，用于旋转整个坐标空间

// 动画相关全局变量（不变）
let modelAnimData = [];
let animationProgress = 0;
let isAnimating = false;

// 初始化场景
function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // 新增：创建场景容器，所有可视元素都添加到这个容器中
    sceneContainer = new THREE.Group();
    loadAllObjFromDir(OBJECT_DIR); // 模型会添加到容器
    createTransparentBox(); // 透明盒子会添加到容器
    scene.add(sceneContainer); // 容器添加到场景
    sceneContainer.rotation.x = -Math.PI / 2; // 核心：绕 X 轴旋转 -90°，实现 Y 轴→Z 轴向上

    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        10000
    );
    camera.position.set(300, 300, 300); // 调整初始位置
    camera.lookAt(0, 0, 0); // 默认注视(0,0,0)

    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 软阴影
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // 电影级色调映射
    renderer.toneMappingExposure = 1.2; // 曝光调整
    document.getElementById('container').appendChild(renderer.domElement);

    addLights();
    initRaycaster();
    initOrbitControls();
    initAnimationControl();
    window.addEventListener('resize', onWindowResize);

    animate();
}

// 创建透明盒子
function createTransparentBox() {
    const radius = 1500 / 2; // 半径
    const height = 1900; // 圆筒高度
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
    transparentBox.rotation.x = Math.PI / 2; // 绕x轴翻转90°，使圆筒z轴与模型packing方向对齐

    const targetWorldPos = new THREE.Vector3(0, 0, 0); // 目标全局坐标（示例：Z轴向上移500）
    transparentBox.parent = sceneContainer; // 先关联父容器
    transparentBox.worldToLocal(targetWorldPos); // 全局坐标 → 父容器的局部坐标
    transparentBox.position.copy(targetWorldPos); // 应用转换后的局部坐标

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
    const distance = (diagonal / 2) / Math.tan(fov / 2) * 1.8; // 增大距离，确保完整视野

    // 核心修改：相机位置和朝向（让模型X轴负方向=相机视角竖直向上）
    camera.position.set(
        center.x,                   // X轴与模型中心对齐
        center.y + distance * 1.0,  // Y轴在模型上方
        center.z + distance * 0.8   // Z轴在模型前方
    );

    // 关键：相机看向模型中心，但通过调整相机自身旋转，让模型X轴负方向呈现为竖直向上
    camera.lookAt(center);
    // 绕Z轴旋转90°，让模型X轴负方向转为相机视角的Y轴正方向（竖直向上）
    camera.rotation.z = Math.PI / 2;

    orbitControls.target.copy(center);
    orbitControls.update();

    // 调整透明容器的位置
    const boxpos = new THREE.Vector3(0, 120, 1900+230);
    boxpos.add(center);
    transparentBox.position.copy(boxpos);
    // const boxScale = diagonal / BOX_SIZE * 1.2;
    // transparentBox.scale.set(boxScale, boxScale, boxScale);
}

// 新增：根据文件名解析形状并返回对应颜色
function getColorByFileName(fileName) {
    // 移除文件扩展名（不区分大小写）
    const baseName = fileName.replace(/\.[a-zA-Z0-9]+$/, '').trim();
    
    // 1. 圆环 Dx_dy_z（支持外径、内径、高度含小数，如 D22_d17_13.65）
    if (/^D\d+(\.\d+)?_d\d+(\.\d+)?_\d+(\.\d+)?$/.test(baseName)) {
        return new THREE.Color(0x00ff00); // 绿色
    }
    // 2. 圆柱 Dx_y（支持直径、高度含小数，如 D35_35、D200_205）
    else if (/^D\d+(\.\d+)?_\d+(\.\d+)?$/.test(baseName)) {
        return new THREE.Color(0xff0000); // 红色
    }
    // 3. 圆柱 Mx_y（支持直径、高度含小数）
    else if (/^M\d+(\.\d+)?_\d+(\.\d+)?$/.test(baseName)) {
        return new THREE.Color(0xffff00); // 黄色
    }
    // 4. 长方体 x_y_z（支持长、宽、高含小数）
    else if (/^\d+(\.\d+)?_\d+(\.\d+)?_\d+(\.\d+)?$/.test(baseName)) {
        return new THREE.Color(0x0000ff); // 蓝色
    }
    // 默认颜色（不匹配任何规则时）
    return new THREE.Color(0xaaaaaa);
}

// 添加增强光源
function addLights() {
    // 环境光调整为更柔和的暖色调，避免过亮
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // 主方向光（模拟太阳光）- 增强阴影质量
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight1.position.set(500, 800, 600); // 更远的光源位置增强阴影效果
    directionalLight1.castShadow = true;
    
    // 阴影质量设置
    directionalLight1.shadow.mapSize.width = 2048;  // 更高分辨率阴影
    directionalLight1.shadow.mapSize.height = 2048;
    directionalLight1.shadow.camera.near = 10;
    directionalLight1.shadow.camera.far = 2000;
    directionalLight1.shadow.camera.left = -1000;
    directionalLight1.shadow.camera.right = 1000;
    directionalLight1.shadow.camera.top = 1000;
    directionalLight1.shadow.camera.bottom = -1000;
    directionalLight1.shadow.radius = 2;  // 阴影模糊
    scene.add(directionalLight1);

    // 辅助光源（补光）- 减少暗部
    const directionalLight2 = new THREE.DirectionalLight(0xe0e0ff, 0.6);
    directionalLight2.position.set(-400, 300, -300);
    directionalLight2.castShadow = false; // 补光不产生阴影避免混乱
    scene.add(directionalLight2);

    // 底部填充光 - 增强底部亮度，避免过暗
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

    // 滑动条事件监听（修改精度处理）
    slider.addEventListener('input', (e) => {
        // 将 0-10000 的值转换为 0-100 范围的百分比（保留两位小数）
        animationProgress = parseInt(e.target.value) / 100;
        // 显示为带两位小数的百分比
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
            model.position.copy(data.startPos); // Z 轴顶端位置
            resetModelHighlight(model);
        } else if (stageProgress <= endProgress) {
            const fallProgress = Math.min(1, (stageProgress - startProgress));
            const easeProgress = 1 - Math.pow(1 - fallProgress, 3);
            model.position.lerpVectors(data.startPos, data.targetPos, easeProgress); // 沿 Z 轴插值下落
            setModelHighlight(model, true);
        } else {
            model.position.copy(data.targetPos); // 回到原始 Z 轴位置
            resetModelHighlight(model);
        }
    });
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
        let failedCount = 0; // 修复：之前漏写 let
        const loader = new THREE.OBJLoader();

        objFilePaths.forEach((filePath, index) => {
            // console.log(`开始加载模型 ${index + 1}/${objFilePaths.length}：`, filePath);
            loader.load(
                filePath,
                (object) => {
                    object.castShadow = true;
                    object.receiveShadow = true;

                    // 材质处理
                    object.traverse((child) => {
                        if (child.isMesh) {
                            // 从文件路径提取文件名
                            const fileName = filePath.split('/').pop();
                            // 根据文件名获取对应颜色
                            const shapeColor = getColorByFileName(fileName);
                            
                            // 使用更真实的物理材质并应用形状颜色
                            child.material = new THREE.MeshStandardMaterial({
                                color: shapeColor,  // 使用根据形状确定的颜色
                                metalness: 0.2,
                                roughness: 0.7,
                                reflectivity: 0.3,
                                shininess: 80,
                                side: THREE.DoubleSide
                            });
                            
                            // 确保接收和投射阴影
                            child.castShadow = true;
                            child.receiveShadow = true;
                            
                            child.userData.originalMaterial = child.material;
                            // 随机色调变化
                            const hueVariation = (Math.random() - 0.5) * 0.1;
                            child.material.color.offsetHSL(hueVariation, 0, 0);
                        }
                    });

                    // 核心修改：模型添加到 sceneContainer（而非直接添加到 scene）
                    sceneContainer.add(object);
                    allModels.push(object);

                    loadedCount++;
                    // console.log(`模型 ${index + 1} 加载成功，当前成功数：${loadedCount}`);
                    
                    if (loadedCount + failedCount < objFilePaths.length) {
                        loadingElem.textContent = `加载模型中...（共 ${objFilePaths.length} 个，已加载 ${loadedCount} 个，失败 ${failedCount} 个）`;
                    } else {
                        loadingElem.style.display = 'none';
                        document.getElementById('info').style.display = 'block';
                        
                        if (loadedCount > 0) {
                            autoAdjustCamera();
                            initModelAnimationData();
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
                    // console.log(`模型 ${index + 1} 加载进度：${progress}%`);
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

// 初始化模型动画数据（按包围盒中心Z坐标排序：Z值更小的模型先下落）
function initModelAnimationData() {
    modelAnimData = [];
    allModels.forEach((model) => {
        // 计算模型包围盒（包含模型所有顶点的最小立方体）
        const boundingBox = new THREE.Box3().setFromObject(model);
        // 获取包围盒中心的Z坐标（用于排序）
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);
        const centerZ = center.y;
        
        modelAnimData.push({
            model: model,
            targetPos: new THREE.Vector3(0, 0, 0), // 模型下落目标位置
            startPos: new THREE.Vector3(0, 0, 1500), // 模型初始位置（顶部）
            centerZ: centerZ // 存储包围盒中心Z坐标用于排序
        });
    });
    
    // 按包围盒中心Z坐标从小到大排序（Z值越小，越先开始下落动画）
    modelAnimData.sort((a, b) => a.centerZ - b.centerZ);
    
    // 初始化所有模型到起始位置
    modelAnimData.forEach((data) => data.model.position.copy(data.startPos));
}

// 解析目录 HTML
// 修复路径拼接逻辑：兼容绝对路径和相对路径，避免URL错误
function parseObjPathsFromDirHTML(html, baseDir) {
    const objPaths = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // 适配新版 Live Server（li > a 格式）
    const linkElements = doc.querySelectorAll('li a');
    linkElements.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.endsWith('.obj')) {
            try {
                // 优先使用 URL 构造器解析（处理相对路径和绝对路径）
                const baseUrl = new URL(baseDir, window.location.origin);
                const fullUrl = new URL(href, baseUrl);
                objPaths.push(fullUrl.href);
                // console.log('解析到OBJ文件路径：', fullUrl.href);
            } catch (e) {
                // 异常时降级使用字符串拼接
                const fullPath = baseDir.endsWith('/') ? baseDir + href : baseDir + '/' + href;
                objPaths.push(fullPath);
                console.warn('路径解析降级处理：', fullPath, e.message);
            }
        }
    });

    // 兼容旧版 Live Server（直接匹配a标签href）
    if (objPaths.length === 0) {
        const regex = /<a\s+href="([^"]+\.obj)"[^>]*>/gi;
        let match;
        while ((match = regex.exec(html)) !== null) {
            try {
                const baseUrl = new URL(baseDir, window.location.origin);
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
}

// 初始化轨道控制器
function initOrbitControls() {
    orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControls.screenSpacePanning = true;
    
    // 扩大缩放范围（原范围：50 - 5000）
    orbitControls.minDistance = 10;  // 缩小最小距离，允许更近距离观察
    orbitControls.maxDistance = 10000;  // 增大最大距离，允许更远距离观察
    
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

    // 鼠标高亮逻辑
    allModels.forEach((model) => {
        model.traverse((child) => {
            if (child.isMesh && child.userData.originalMaterial) {
                if (model === hoveredModel) {
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
    });
}

// 鼠标离开事件
function onMouseLeave() {
    if (isAnimating) return; // 动画播放时不重置

    allModels.forEach((model) => {
        model.traverse((child) => {
            if (child.isMesh && child.userData.originalMaterial) {
                child.material = child.userData.originalMaterial;
            }
        });
    });
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
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
    
    // if (/^D\d+(\.\d+)?_d\d+(\.\d+)?_\d+(\.\d+)?$/.test(baseName)) {
    //     return new THREE.Color(0x00ff00);
    // }
    // else if (/^D\d+(\.\d+)?_\d+(\.\d+)?$/.test(baseName)) {
    //     return new THREE.Color(0xff0000);
    // }
    // else if (/^M\d+(\.\d+)?_\d+(\.\d+)?$/.test(baseName)) {
    //     return new THREE.Color(0xffff00);
    // }
    // else if (/^\d+(\.\d+)?_\d+(\.\d+)?_\d+(\.\d+)?$/.test(baseName)) {
    //     return new THREE.Color(0x0000ff);
    // }
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
            if (selectedModel !== model) {
                resetModelHighlight(model);
                resetListHighlight(model);
            }
        } else if (stageProgress <= endProgress) {
            const fallProgress = Math.min(1, (stageProgress - startProgress));
            const easeProgress = 1 - Math.pow(1 - fallProgress, 3);
            model.position.lerpVectors(data.startPos, data.targetPos, easeProgress);
            setModelHighlight(model, true);
            setListHighlight(model, true);
        } else {
            model.position.copy(data.targetPos);
            if (selectedModel !== model) {
                resetModelHighlight(model);
                resetListHighlight(model);
            }
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
            const model = modelNameMap.get(listItem);
            // 使用穿透高亮材质
            setModelListHighlight(model, true);
            setListHighlight(model, true);
        });

        listItem.addEventListener('mouseleave', () => {
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
        const objFileNames = [
        '290_22_10-1_1.obj', 
'290_22_10-2_1.obj', 
'290_22_10-3_1.obj', 
'290_22_10-4_1.obj', 
'290_22_10-5_1.obj', 
'290_22_10-6_1.obj', 
'290_22_10-7_1.obj', 
'290_22_10-8_1.obj', 
'290_22_10-9_1.obj', 
'396.5_84.1_70-10_1.obj', 
'396.5_84.1_70-11_1.obj', 
'396.5_84.1_70-12_1.obj', 
'396.5_84.1_70-13_1.obj', 
'396.5_84.1_70-14_1.obj', 
'396.5_84.1_70-15_1.obj', 
'396.5_84.1_70-16_1.obj', 
'396.5_84.1_70-17_1.obj', 
'396.5_84.1_70-18_1.obj', 
'396.5_84.1_70-19_1.obj', 
'396.5_84.1_70-1_1.obj', 
'396.5_84.1_70-20_1.obj', 
'396.5_84.1_70-21_1.obj', 
'396.5_84.1_70-22_1.obj', 
'396.5_84.1_70-23_1.obj', 
'396.5_84.1_70-24_1.obj', 
'396.5_84.1_70-25_1.obj', 
'396.5_84.1_70-26_1.obj', 
'396.5_84.1_70-27_1.obj', 
'396.5_84.1_70-28_1.obj', 
'396.5_84.1_70-29_1.obj', 
'396.5_84.1_70-2_1.obj', 
'396.5_84.1_70-30_1.obj', 
'396.5_84.1_70-31_1.obj', 
'396.5_84.1_70-32_1.obj', 
'396.5_84.1_70-33_1.obj', 
'396.5_84.1_70-34_1.obj', 
'396.5_84.1_70-3_1.obj', 
'396.5_84.1_70-4_1.obj', 
'396.5_84.1_70-5_1.obj', 
'396.5_84.1_70-6_1.obj', 
'396.5_84.1_70-7_1.obj', 
'396.5_84.1_70-8_1.obj', 
'396.5_84.1_70-9_1.obj', 
'800_200_10-1_1.obj', 
'800_200_10-2_1.obj', 
'800_200_10-3_1.obj', 
'800_200_10-4_1.obj', 
'800_200_10-5_1.obj', 
'800_66_15-1_1.obj', 
'800_66_15-2_1.obj', 
'800_66_15-3_1.obj', 
'800_66_15-4_1.obj', 
'800_66_15-5_1.obj', 
'D130_260-1_1.obj', 
'D130_260-2_1.obj', 
'D130_260-3_1.obj', 
'D130_260-4_1.obj', 
'D130_260-5_1.obj', 
'D130_260-6_1.obj', 
'D130_260-7_1.obj', 
'D142_d136_137-100_1.obj', 
'D142_d136_137-101_1.obj', 
'D142_d136_137-102_1.obj', 
'D142_d136_137-103_1.obj', 
'D142_d136_137-104_1.obj', 
'D142_d136_137-105_1.obj', 
'D142_d136_137-106_1.obj', 
'D142_d136_137-107_1.obj', 
'D142_d136_137-108_1.obj', 
'D142_d136_137-10_1.obj', 
'D142_d136_137-11_1.obj', 
'D142_d136_137-12_1.obj', 
'D142_d136_137-13_1.obj', 
'D142_d136_137-14_1.obj', 
'D142_d136_137-15_1.obj', 
'D142_d136_137-16_1.obj', 
'D142_d136_137-17_1.obj', 
'D142_d136_137-18_1.obj', 
'D142_d136_137-19_1.obj', 
'D142_d136_137-1_1.obj', 
'D142_d136_137-20_1.obj', 
'D142_d136_137-21_1.obj', 
'D142_d136_137-22_1.obj', 
'D142_d136_137-23_1.obj', 
'D142_d136_137-24_1.obj', 
'D142_d136_137-25_1.obj', 
'D142_d136_137-26_1.obj', 
'D142_d136_137-27_1.obj', 
'D142_d136_137-28_1.obj', 
'D142_d136_137-29_1.obj', 
'D142_d136_137-2_1.obj', 
'D142_d136_137-30_1.obj', 
'D142_d136_137-31_1.obj', 
'D142_d136_137-32_1.obj', 
'D142_d136_137-33_1.obj', 
'D142_d136_137-34_1.obj', 
'D142_d136_137-35_1.obj', 
'D142_d136_137-36_1.obj', 
'D142_d136_137-37_1.obj', 
'D142_d136_137-38_1.obj', 
'D142_d136_137-39_1.obj', 
'D142_d136_137-3_1.obj', 
'D142_d136_137-40_1.obj', 
'D142_d136_137-41_1.obj', 
'D142_d136_137-42_1.obj', 
'D142_d136_137-43_1.obj', 
'D142_d136_137-44_1.obj', 
'D142_d136_137-45_1.obj', 
'D142_d136_137-46_1.obj', 
'D142_d136_137-47_1.obj', 
'D142_d136_137-48_1.obj', 
'D142_d136_137-49_1.obj', 
'D142_d136_137-4_1.obj', 
'D142_d136_137-50_1.obj', 
'D142_d136_137-51_1.obj', 
'D142_d136_137-52_1.obj', 
'D142_d136_137-53_1.obj', 
'D142_d136_137-54_1.obj', 
'D142_d136_137-55_1.obj', 
'D142_d136_137-56_1.obj', 
'D142_d136_137-57_1.obj', 
'D142_d136_137-58_1.obj', 
'D142_d136_137-59_1.obj', 
'D142_d136_137-5_1.obj', 
'D142_d136_137-60_1.obj', 
'D142_d136_137-61_1.obj', 
'D142_d136_137-62_1.obj', 
'D142_d136_137-63_1.obj', 
'D142_d136_137-64_1.obj', 
'D142_d136_137-65_1.obj', 
'D142_d136_137-66_1.obj', 
'D142_d136_137-67_1.obj', 
'D142_d136_137-68_1.obj', 
'D142_d136_137-69_1.obj', 
'D142_d136_137-6_1.obj', 
'D142_d136_137-70_1.obj', 
'D142_d136_137-71_1.obj', 
'D142_d136_137-72_1.obj', 
'D142_d136_137-73_1.obj', 
'D142_d136_137-74_1.obj', 
'D142_d136_137-75_1.obj', 
'D142_d136_137-76_1.obj', 
'D142_d136_137-77_1.obj', 
'D142_d136_137-78_1.obj', 
'D142_d136_137-79_1.obj', 
'D142_d136_137-7_1.obj', 
'D142_d136_137-80_1.obj', 
'D142_d136_137-81_1.obj', 
'D142_d136_137-82_1.obj', 
'D142_d136_137-83_1.obj', 
'D142_d136_137-84_1.obj', 
'D142_d136_137-85_1.obj', 
'D142_d136_137-86_1.obj', 
'D142_d136_137-87_1.obj', 
'D142_d136_137-88_1.obj', 
'D142_d136_137-89_1.obj', 
'D142_d136_137-8_1.obj', 
'D142_d136_137-90_1.obj', 
'D142_d136_137-91_1.obj', 
'D142_d136_137-92_1.obj', 
'D142_d136_137-93_1.obj', 
'D142_d136_137-94_1.obj', 
'D142_d136_137-95_1.obj', 
'D142_d136_137-96_1.obj', 
'D142_d136_137-97_1.obj', 
'D142_d136_137-98_1.obj', 
'D142_d136_137-99_1.obj', 
'D142_d136_137-9_1.obj', 
'D175_10-1_1.obj', 
'D175_10-2_1.obj', 
'D175_10-3_1.obj', 
'D187_d156_108-1_1.obj', 
'D187_d156_108-2_1.obj', 
'D187_d156_108-3_1.obj', 
'D187_d156_110-10_1.obj', 
'D187_d156_110-11_1.obj', 
'D187_d156_110-12_1.obj', 
'D187_d156_110-13_1.obj', 
'D187_d156_110-14_1.obj', 
'D187_d156_110-15_1.obj', 
'D187_d156_110-16_1.obj', 
'D187_d156_110-17_1.obj', 
'D187_d156_110-18_1.obj', 
'D187_d156_110-19_1.obj', 
'D187_d156_110-1_1.obj', 
'D187_d156_110-20_1.obj', 
'D187_d156_110-21_1.obj', 
'D187_d156_110-22_1.obj', 
'D187_d156_110-23_1.obj', 
'D187_d156_110-24_1.obj', 
'D187_d156_110-25_1.obj', 
'D187_d156_110-2_1.obj', 
'D187_d156_110-3_1.obj', 
'D187_d156_110-4_1.obj', 
'D187_d156_110-5_1.obj', 
'D187_d156_110-6_1.obj', 
'D187_d156_110-7_1.obj', 
'D187_d156_110-8_1.obj', 
'D187_d156_110-9_1.obj', 
'D187_d156_74-1_1.obj', 
'D187_d156_74-2_1.obj', 
'D197_d156_102-1_1.obj', 
'D197_d156_112-1_1.obj', 
'D197_d156_112-2_1.obj', 
'D197_d156_112-3_1.obj', 
'D197_d156_112-4_1.obj', 
'D197_d156_112-5_1.obj', 
'D197_d156_112-6_1.obj', 
'D197_d156_112-7_1.obj', 
'D197_d156_113-1_1.obj', 
'D197_d156_113-2_1.obj', 
'D197_d156_168-1_1.obj', 
'D197_d156_91-1_1.obj', 
'D197_d156_91-2_1.obj', 
'D200_205-10_1.obj', 
'D200_205-11_1.obj', 
'D200_205-12_1.obj', 
'D200_205-13_1.obj', 
'D200_205-14_1.obj', 
'D200_205-15_1.obj', 
'D200_205-16_1.obj', 
'D200_205-17_1.obj', 
'D200_205-18_1.obj', 
'D200_205-19_1.obj', 
'D200_205-1_1.obj', 
'D200_205-20_1.obj', 
'D200_205-21_1.obj', 
'D200_205-22_1.obj', 
'D200_205-23_1.obj', 
'D200_205-24_1.obj', 
'D200_205-25_1.obj', 
'D200_205-26_1.obj', 
'D200_205-27_1.obj', 
'D200_205-28_1.obj', 
'D200_205-29_1.obj', 
'D200_205-2_1.obj', 
'D200_205-30_1.obj', 
'D200_205-31_1.obj', 
'D200_205-32_1.obj', 
'D200_205-33_1.obj', 
'D200_205-34_1.obj', 
'D200_205-35_1.obj', 
'D200_205-36_1.obj', 
'D200_205-37_1.obj', 
'D200_205-38_1.obj', 
'D200_205-39_1.obj', 
'D200_205-3_1.obj', 
'D200_205-40_1.obj', 
'D200_205-4_1.obj', 
'D200_205-5_1.obj', 
'D200_205-6_1.obj', 
'D200_205-7_1.obj', 
'D200_205-8_1.obj', 
'D200_205-9_1.obj', 
'D200_d173_33-100_1.obj', 
'D200_d173_33-101_1.obj', 
'D200_d173_33-102_1.obj', 
'D200_d173_33-103_1.obj', 
'D200_d173_33-104_1.obj', 
'D200_d173_33-105_1.obj', 
'D200_d173_33-106_1.obj', 
'D200_d173_33-107_1.obj', 
'D200_d173_33-108_1.obj', 
'D200_d173_33-109_1.obj', 
'D200_d173_33-10_1.obj', 
'D200_d173_33-110_1.obj', 
'D200_d173_33-111_1.obj', 
'D200_d173_33-112_1.obj', 
'D200_d173_33-113_1.obj', 
'D200_d173_33-114_1.obj', 
'D200_d173_33-115_1.obj', 
'D200_d173_33-116_1.obj', 
'D200_d173_33-117_1.obj', 
'D200_d173_33-118_1.obj', 
'D200_d173_33-119_1.obj', 
'D200_d173_33-11_1.obj', 
'D200_d173_33-120_1.obj', 
'D200_d173_33-12_1.obj', 
'D200_d173_33-13_1.obj', 
'D200_d173_33-14_1.obj', 
'D200_d173_33-15_1.obj', 
'D200_d173_33-16_1.obj', 
'D200_d173_33-17_1.obj', 
'D200_d173_33-18_1.obj', 
'D200_d173_33-19_1.obj', 
'D200_d173_33-1_1.obj', 
'D200_d173_33-20_1.obj', 
'D200_d173_33-21_1.obj', 
'D200_d173_33-22_1.obj', 
'D200_d173_33-23_1.obj', 
'D200_d173_33-24_1.obj', 
'D200_d173_33-25_1.obj', 
'D200_d173_33-26_1.obj', 
'D200_d173_33-27_1.obj', 
'D200_d173_33-28_1.obj', 
'D200_d173_33-29_1.obj', 
'D200_d173_33-2_1.obj', 
'D200_d173_33-30_1.obj', 
'D200_d173_33-31_1.obj', 
'D200_d173_33-32_1.obj', 
'D200_d173_33-33_1.obj', 
'D200_d173_33-34_1.obj', 
'D200_d173_33-35_1.obj', 
'D200_d173_33-36_1.obj', 
'D200_d173_33-37_1.obj', 
'D200_d173_33-38_1.obj', 
'D200_d173_33-39_1.obj', 
'D200_d173_33-3_1.obj', 
'D200_d173_33-40_1.obj', 
'D200_d173_33-41_1.obj', 
'D200_d173_33-42_1.obj', 
'D200_d173_33-43_1.obj', 
'D200_d173_33-44_1.obj', 
'D200_d173_33-45_1.obj', 
'D200_d173_33-46_1.obj', 
'D200_d173_33-47_1.obj', 
'D200_d173_33-48_1.obj', 
'D200_d173_33-49_1.obj', 
'D200_d173_33-4_1.obj', 
'D200_d173_33-50_1.obj', 
'D200_d173_33-51_1.obj', 
'D200_d173_33-52_1.obj', 
'D200_d173_33-53_1.obj', 
'D200_d173_33-54_1.obj', 
'D200_d173_33-55_1.obj', 
'D200_d173_33-56_1.obj', 
'D200_d173_33-57_1.obj', 
'D200_d173_33-58_1.obj', 
'D200_d173_33-59_1.obj', 
'D200_d173_33-5_1.obj', 
'D200_d173_33-60_1.obj', 
'D200_d173_33-61_1.obj', 
'D200_d173_33-62_1.obj', 
'D200_d173_33-63_1.obj', 
'D200_d173_33-64_1.obj', 
'D200_d173_33-65_1.obj', 
'D200_d173_33-66_1.obj', 
'D200_d173_33-67_1.obj', 
'D200_d173_33-68_1.obj', 
'D200_d173_33-69_1.obj', 
'D200_d173_33-6_1.obj', 
'D200_d173_33-70_1.obj', 
'D200_d173_33-71_1.obj', 
'D200_d173_33-72_1.obj', 
'D200_d173_33-73_1.obj', 
'D200_d173_33-74_1.obj', 
'D200_d173_33-75_1.obj', 
'D200_d173_33-76_1.obj', 
'D200_d173_33-77_1.obj', 
'D200_d173_33-78_1.obj', 
'D200_d173_33-79_1.obj', 
'D200_d173_33-7_1.obj', 
'D200_d173_33-80_1.obj', 
'D200_d173_33-81_1.obj', 
'D200_d173_33-82_1.obj', 
'D200_d173_33-83_1.obj', 
'D200_d173_33-84_1.obj', 
'D200_d173_33-85_1.obj', 
'D200_d173_33-86_1.obj', 
'D200_d173_33-87_1.obj', 
'D200_d173_33-88_1.obj', 
'D200_d173_33-89_1.obj', 
'D200_d173_33-8_1.obj', 
'D200_d173_33-90_1.obj', 
'D200_d173_33-91_1.obj', 
'D200_d173_33-92_1.obj', 
'D200_d173_33-93_1.obj', 
'D200_d173_33-94_1.obj', 
'D200_d173_33-95_1.obj', 
'D200_d173_33-96_1.obj', 
'D200_d173_33-97_1.obj', 
'D200_d173_33-98_1.obj', 
'D200_d173_33-99_1.obj', 
'D200_d173_33-9_1.obj', 
'D212_d198_45-100_1.obj', 
'D212_d198_45-101_1.obj', 
'D212_d198_45-102_1.obj', 
'D212_d198_45-103_1.obj', 
'D212_d198_45-104_1.obj', 
'D212_d198_45-105_1.obj', 
'D212_d198_45-106_1.obj', 
'D212_d198_45-107_1.obj', 
'D212_d198_45-108_1.obj', 
'D212_d198_45-109_1.obj', 
'D212_d198_45-10_1.obj', 
'D212_d198_45-110_1.obj', 
'D212_d198_45-111_1.obj', 
'D212_d198_45-112_1.obj', 
'D212_d198_45-113_1.obj', 
'D212_d198_45-114_1.obj', 
'D212_d198_45-115_1.obj', 
'D212_d198_45-116_1.obj', 
'D212_d198_45-117_1.obj', 
'D212_d198_45-118_1.obj', 
'D212_d198_45-119_1.obj', 
'D212_d198_45-11_1.obj', 
'D212_d198_45-120_1.obj', 
'D212_d198_45-121_1.obj', 
'D212_d198_45-122_1.obj', 
'D212_d198_45-123_1.obj', 
'D212_d198_45-124_1.obj', 
'D212_d198_45-125_1.obj', 
'D212_d198_45-126_1.obj', 
'D212_d198_45-127_1.obj', 
'D212_d198_45-128_1.obj', 
'D212_d198_45-129_1.obj', 
'D212_d198_45-12_1.obj', 
'D212_d198_45-130_1.obj', 
'D212_d198_45-131_1.obj', 
'D212_d198_45-132_1.obj', 
'D212_d198_45-133_1.obj', 
'D212_d198_45-134_1.obj', 
'D212_d198_45-135_1.obj', 
'D212_d198_45-136_1.obj', 
'D212_d198_45-137_1.obj', 
'D212_d198_45-138_1.obj', 
'D212_d198_45-139_1.obj', 
'D212_d198_45-13_1.obj', 
'D212_d198_45-140_1.obj', 
'D212_d198_45-141_1.obj', 
'D212_d198_45-142_1.obj', 
'D212_d198_45-143_1.obj', 
'D212_d198_45-144_1.obj', 
'D212_d198_45-145_1.obj', 
'D212_d198_45-146_1.obj', 
'D212_d198_45-147_1.obj', 
'D212_d198_45-148_1.obj', 
'D212_d198_45-149_1.obj', 
'D212_d198_45-14_1.obj', 
'D212_d198_45-150_1.obj', 
'D212_d198_45-151_1.obj', 
'D212_d198_45-152_1.obj', 
'D212_d198_45-153_1.obj', 
'D212_d198_45-154_1.obj', 
'D212_d198_45-155_1.obj', 
'D212_d198_45-156_1.obj', 
'D212_d198_45-157_1.obj', 
'D212_d198_45-158_1.obj', 
'D212_d198_45-159_1.obj', 
'D212_d198_45-15_1.obj', 
'D212_d198_45-160_1.obj', 
'D212_d198_45-161_1.obj', 
'D212_d198_45-162_1.obj', 
'D212_d198_45-163_1.obj', 
'D212_d198_45-164_1.obj', 
'D212_d198_45-165_1.obj', 
'D212_d198_45-166_1.obj', 
'D212_d198_45-167_1.obj', 
'D212_d198_45-168_1.obj', 
'D212_d198_45-169_1.obj', 
'D212_d198_45-16_1.obj', 
'D212_d198_45-170_1.obj', 
'D212_d198_45-171_1.obj', 
'D212_d198_45-172_1.obj', 
'D212_d198_45-173_1.obj', 
'D212_d198_45-174_1.obj', 
'D212_d198_45-175_1.obj', 
'D212_d198_45-176_1.obj', 
'D212_d198_45-177_1.obj', 
'D212_d198_45-178_1.obj', 
'D212_d198_45-179_1.obj', 
'D212_d198_45-17_1.obj', 
'D212_d198_45-180_1.obj', 
'D212_d198_45-181_1.obj', 
'D212_d198_45-182_1.obj', 
'D212_d198_45-183_1.obj', 
'D212_d198_45-184_1.obj', 
'D212_d198_45-185_1.obj', 
'D212_d198_45-186_1.obj', 
'D212_d198_45-187_1.obj', 
'D212_d198_45-188_1.obj', 
'D212_d198_45-189_1.obj', 
'D212_d198_45-18_1.obj', 
'D212_d198_45-190_1.obj', 
'D212_d198_45-191_1.obj', 
'D212_d198_45-192_1.obj', 
'D212_d198_45-193_1.obj', 
'D212_d198_45-194_1.obj', 
'D212_d198_45-195_1.obj', 
'D212_d198_45-196_1.obj', 
'D212_d198_45-197_1.obj', 
'D212_d198_45-198_1.obj', 
'D212_d198_45-199_1.obj', 
'D212_d198_45-19_1.obj', 
'D212_d198_45-1_1.obj', 
'D212_d198_45-200_1.obj', 
'D212_d198_45-20_1.obj', 
'D212_d198_45-21_1.obj', 
'D212_d198_45-22_1.obj', 
'D212_d198_45-23_1.obj', 
'D212_d198_45-24_1.obj', 
'D212_d198_45-25_1.obj', 
'D212_d198_45-26_1.obj', 
'D212_d198_45-27_1.obj', 
'D212_d198_45-28_1.obj', 
'D212_d198_45-29_1.obj', 
'D212_d198_45-2_1.obj', 
'D212_d198_45-30_1.obj', 
'D212_d198_45-31_1.obj', 
'D212_d198_45-32_1.obj', 
'D212_d198_45-33_1.obj', 
'D212_d198_45-34_1.obj', 
'D212_d198_45-35_1.obj', 
'D212_d198_45-36_1.obj', 
'D212_d198_45-37_1.obj', 
'D212_d198_45-38_1.obj', 
'D212_d198_45-39_1.obj', 
'D212_d198_45-3_1.obj', 
'D212_d198_45-40_1.obj', 
'D212_d198_45-41_1.obj', 
'D212_d198_45-42_1.obj', 
'D212_d198_45-43_1.obj', 
'D212_d198_45-44_1.obj', 
'D212_d198_45-45_1.obj', 
'D212_d198_45-46_1.obj', 
'D212_d198_45-47_1.obj', 
'D212_d198_45-48_1.obj', 
'D212_d198_45-49_1.obj', 
'D212_d198_45-4_1.obj', 
'D212_d198_45-50_1.obj', 
'D212_d198_45-51_1.obj', 
'D212_d198_45-52_1.obj', 
'D212_d198_45-53_1.obj', 
'D212_d198_45-54_1.obj', 
'D212_d198_45-55_1.obj', 
'D212_d198_45-56_1.obj', 
'D212_d198_45-57_1.obj', 
'D212_d198_45-58_1.obj', 
'D212_d198_45-59_1.obj', 
'D212_d198_45-5_1.obj', 
'D212_d198_45-60_1.obj', 
'D212_d198_45-61_1.obj', 
'D212_d198_45-62_1.obj', 
'D212_d198_45-63_1.obj', 
'D212_d198_45-64_1.obj', 
'D212_d198_45-65_1.obj', 
'D212_d198_45-66_1.obj', 
'D212_d198_45-67_1.obj', 
'D212_d198_45-68_1.obj', 
'D212_d198_45-69_1.obj', 
'D212_d198_45-6_1.obj', 
'D212_d198_45-70_1.obj', 
'D212_d198_45-71_1.obj', 
'D212_d198_45-72_1.obj', 
'D212_d198_45-73_1.obj', 
'D212_d198_45-74_1.obj', 
'D212_d198_45-75_1.obj', 
'D212_d198_45-76_1.obj', 
'D212_d198_45-77_1.obj', 
'D212_d198_45-78_1.obj', 
'D212_d198_45-79_1.obj', 
'D212_d198_45-7_1.obj', 
'D212_d198_45-80_1.obj', 
'D212_d198_45-81_1.obj', 
'D212_d198_45-82_1.obj', 
'D212_d198_45-83_1.obj', 
'D212_d198_45-84_1.obj', 
'D212_d198_45-85_1.obj', 
'D212_d198_45-86_1.obj', 
'D212_d198_45-87_1.obj', 
'D212_d198_45-88_1.obj', 
'D212_d198_45-89_1.obj', 
'D212_d198_45-8_1.obj', 
'D212_d198_45-90_1.obj', 
'D212_d198_45-91_1.obj', 
'D212_d198_45-92_1.obj', 
'D212_d198_45-93_1.obj', 
'D212_d198_45-94_1.obj', 
'D212_d198_45-95_1.obj', 
'D212_d198_45-96_1.obj', 
'D212_d198_45-97_1.obj', 
'D212_d198_45-98_1.obj', 
'D212_d198_45-99_1.obj', 
'D212_d198_45-9_1.obj', 
'D22_d17_13.65-10_1.obj', 
'D22_d17_13.65-11_1.obj', 
'D22_d17_13.65-12_1.obj', 
'D22_d17_13.65-13_1.obj', 
'D22_d17_13.65-14_1.obj', 
'D22_d17_13.65-15_1.obj', 
'D22_d17_13.65-16_1.obj', 
'D22_d17_13.65-17_1.obj', 
'D22_d17_13.65-18_1.obj', 
'D22_d17_13.65-19_1.obj', 
'D22_d17_13.65-1_1.obj', 
'D22_d17_13.65-20_1.obj', 
'D22_d17_13.65-21_1.obj', 
'D22_d17_13.65-22_1.obj', 
'D22_d17_13.65-23_1.obj', 
'D22_d17_13.65-24_1.obj', 
'D22_d17_13.65-25_1.obj', 
'D22_d17_13.65-26_1.obj', 
'D22_d17_13.65-27_1.obj', 
'D22_d17_13.65-28_1.obj', 
'D22_d17_13.65-29_1.obj', 
'D22_d17_13.65-2_1.obj', 
'D22_d17_13.65-30_1.obj', 
'D22_d17_13.65-31_1.obj', 
'D22_d17_13.65-32_1.obj', 
'D22_d17_13.65-33_1.obj', 
'D22_d17_13.65-34_1.obj', 
'D22_d17_13.65-35_1.obj', 
'D22_d17_13.65-36_1.obj', 
'D22_d17_13.65-37_1.obj', 
'D22_d17_13.65-38_1.obj', 
'D22_d17_13.65-39_1.obj', 
'D22_d17_13.65-3_1.obj', 
'D22_d17_13.65-40_1.obj', 
'D22_d17_13.65-41_1.obj', 
'D22_d17_13.65-42_1.obj', 
'D22_d17_13.65-43_1.obj', 
'D22_d17_13.65-44_1.obj', 
'D22_d17_13.65-45_1.obj', 
'D22_d17_13.65-46_1.obj', 
'D22_d17_13.65-47_1.obj', 
'D22_d17_13.65-48_1.obj', 
'D22_d17_13.65-49_1.obj', 
'D22_d17_13.65-4_1.obj', 
'D22_d17_13.65-50_1.obj', 
'D22_d17_13.65-51_1.obj', 
'D22_d17_13.65-52_1.obj', 
'D22_d17_13.65-53_1.obj', 
'D22_d17_13.65-54_1.obj', 
'D22_d17_13.65-55_1.obj', 
'D22_d17_13.65-56_1.obj', 
'D22_d17_13.65-57_1.obj', 
'D22_d17_13.65-58_1.obj', 
'D22_d17_13.65-59_1.obj', 
'D22_d17_13.65-5_1.obj', 
'D22_d17_13.65-60_1.obj', 
'D22_d17_13.65-61_1.obj', 
'D22_d17_13.65-62_1.obj', 
'D22_d17_13.65-63_1.obj', 
'D22_d17_13.65-64_1.obj', 
'D22_d17_13.65-65_1.obj', 
'D22_d17_13.65-66_1.obj', 
'D22_d17_13.65-67_1.obj', 
'D22_d17_13.65-68_1.obj', 
'D22_d17_13.65-69_1.obj', 
'D22_d17_13.65-6_1.obj', 
'D22_d17_13.65-70_1.obj', 
'D22_d17_13.65-71_1.obj', 
'D22_d17_13.65-72_1.obj', 
'D22_d17_13.65-73_1.obj', 
'D22_d17_13.65-74_1.obj', 
'D22_d17_13.65-75_1.obj', 
'D22_d17_13.65-76_1.obj', 
'D22_d17_13.65-77_1.obj', 
'D22_d17_13.65-78_1.obj', 
'D22_d17_13.65-79_1.obj', 
'D22_d17_13.65-7_1.obj', 
'D22_d17_13.65-80_1.obj', 
'D22_d17_13.65-81_1.obj', 
'D22_d17_13.65-8_1.obj', 
'D22_d17_13.65-9_1.obj', 
'D240_d209_10-1_1.obj', 
'D240_d209_10-2_1.obj', 
'D240_d209_10-3_1.obj', 
'D240_d209_10-4_1.obj', 
'D240_d209_10-5_1.obj', 
'D248_d206_106-1_1.obj', 
'D248_d206_179-1_1.obj', 
'D248_d206_185-1_1.obj', 
'D260_d200_63-1_1.obj', 
'D260_d200_63-2_1.obj', 
'D260_d200_63-3_1.obj', 
'D260_d200_63-4_1.obj', 
'D260_d200_63-5_1.obj', 
'D260_d200_63-6_1.obj', 
'D270_d249_142-10_1.obj', 
'D270_d249_142-11_1.obj', 
'D270_d249_142-12_1.obj', 
'D270_d249_142-13_1.obj', 
'D270_d249_142-14_1.obj', 
'D270_d249_142-15_1.obj', 
'D270_d249_142-16_1.obj', 
'D270_d249_142-17_1.obj', 
'D270_d249_142-18_1.obj', 
'D270_d249_142-19_1.obj', 
'D270_d249_142-1_1.obj', 
'D270_d249_142-20_1.obj', 
'D270_d249_142-21_1.obj', 
'D270_d249_142-22_1.obj', 
'D270_d249_142-23_1.obj', 
'D270_d249_142-2_1.obj', 
'D270_d249_142-3_1.obj', 
'D270_d249_142-4_1.obj', 
'D270_d249_142-5_1.obj', 
'D270_d249_142-6_1.obj', 
'D270_d249_142-7_1.obj', 
'D270_d249_142-8_1.obj', 
'D270_d249_142-9_1.obj', 
'D330_d230_50-10_1.obj', 
'D330_d230_50-11_1.obj', 
'D330_d230_50-12_1.obj', 
'D330_d230_50-13_1.obj', 
'D330_d230_50-14_1.obj', 
'D330_d230_50-15_1.obj', 
'D330_d230_50-16_1.obj', 
'D330_d230_50-17_1.obj', 
'D330_d230_50-18_1.obj', 
'D330_d230_50-19_1.obj', 
'D330_d230_50-1_1.obj', 
'D330_d230_50-20_1.obj', 
'D330_d230_50-21_1.obj', 
'D330_d230_50-22_1.obj', 
'D330_d230_50-23_1.obj', 
'D330_d230_50-24_1.obj', 
'D330_d230_50-25_1.obj', 
'D330_d230_50-26_1.obj', 
'D330_d230_50-27_1.obj', 
'D330_d230_50-28_1.obj', 
'D330_d230_50-29_1.obj', 
'D330_d230_50-2_1.obj', 
'D330_d230_50-30_1.obj', 
'D330_d230_50-3_1.obj', 
'D330_d230_50-4_1.obj', 
'D330_d230_50-5_1.obj', 
'D330_d230_50-6_1.obj', 
'D330_d230_50-7_1.obj', 
'D330_d230_50-8_1.obj', 
'D330_d230_50-9_1.obj', 
'D350_50-1_1.obj', 
'D350_50-2_1.obj', 
'D350_d240_50-10_1.obj', 
'D350_d240_50-1_1.obj', 
'D350_d240_50-2_1.obj', 
'D350_d240_50-3_1.obj', 
'D350_d240_50-4_1.obj', 
'D350_d240_50-5_1.obj', 
'D350_d240_50-6_1.obj', 
'D350_d240_50-7_1.obj', 
'D350_d240_50-8_1.obj', 
'D350_d240_50-9_1.obj', 
'D35_35-10_1.obj', 
'D35_35-11_1.obj', 
'D35_35-12_1.obj', 
'D35_35-13_1.obj', 
'D35_35-14_1.obj', 
'D35_35-15_1.obj', 
'D35_35-16_1.obj', 
'D35_35-17_1.obj', 
'D35_35-18_1.obj', 
'D35_35-19_1.obj', 
'D35_35-1_1.obj', 
'D35_35-20_1.obj', 
'D35_35-21_1.obj', 
'D35_35-22_1.obj', 
'D35_35-23_1.obj', 
'D35_35-24_1.obj', 
'D35_35-25_1.obj', 
'D35_35-26_1.obj', 
'D35_35-27_1.obj', 
'D35_35-28_1.obj', 
'D35_35-29_1.obj', 
'D35_35-2_1.obj', 
'D35_35-3_1.obj', 
'D35_35-4_1.obj', 
'D35_35-5_1.obj', 
'D35_35-6_1.obj', 
'D35_35-7_1.obj', 
'D35_35-8_1.obj', 
'D35_35-9_1.obj', 
'D50_6-1_1.obj', 
'D60_45-1_1.obj', 
'D60_45-2_1.obj', 
'D60_45-3_1.obj', 
'D60_45-4_1.obj', 
'D60_45-5_1.obj', 
'D60_45-6_1.obj', 
'D60_45-7_1.obj', 
'D60_45-8_1.obj', 
'M184_13-10_1.obj', 
'M184_13-11_1.obj', 
'M184_13-12_1.obj', 
'M184_13-13_1.obj', 
'M184_13-14_1.obj', 
'M184_13-15_1.obj', 
'M184_13-16_1.obj', 
'M184_13-17_1.obj', 
'M184_13-18_1.obj', 
'M184_13-19_1.obj', 
'M184_13-1_1.obj', 
'M184_13-20_1.obj', 
'M184_13-21_1.obj', 
'M184_13-22_1.obj', 
'M184_13-23_1.obj', 
'M184_13-24_1.obj', 
'M184_13-25_1.obj', 
'M184_13-26_1.obj', 
'M184_13-27_1.obj', 
'M184_13-28_1.obj', 
'M184_13-29_1.obj', 
'M184_13-2_1.obj', 
'M184_13-30_1.obj', 
'M184_13-31_1.obj', 
'M184_13-32_1.obj', 
'M184_13-33_1.obj', 
'M184_13-34_1.obj', 
'M184_13-35_1.obj', 
'M184_13-36_1.obj', 
'M184_13-37_1.obj', 
'M184_13-38_1.obj', 
'M184_13-39_1.obj', 
'M184_13-3_1.obj', 
'M184_13-40_1.obj', 
'M184_13-4_1.obj', 
'M184_13-5_1.obj', 
'M184_13-6_1.obj', 
'M184_13-7_1.obj', 
'M184_13-8_1.obj', 
'M184_13-9_1.obj', 
        // 补充所有实际的 .obj 文件名
        ];
        // 根据文件名生成完整路径
        const objFilePaths = objFileNames.map(filename => validDirPath + filename);

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
                        // 注释掉，不显示info bar
                        // document.getElementById('info').style.display = 'block';
                        
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
                        // document.getElementById('info').style.display = 'block';
                        
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
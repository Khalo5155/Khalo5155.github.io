// 全局变量定义（新增 sceneContainer 和物料列表相关变量）
let scene, camera, renderer, raycaster, mouse, orbitControls;
let transparentBox, allModels = [];
const OBJECT_DIR = './Objects4/';
const BOX_SIZE = 1000;
let sceneContainer;
let materialListElement; // 物料列表容器
let modelNameMap = new Map(); // 模型与名称的映射关系
let highlightPenetrateMaterial; // 穿透遮挡物的高亮材质
let selectedModel = null; // 当前选中的模型
let css2DRenderer;

// 动画相关全局变量
let modelAnimData = [];
let animationProgress = 0;
let isAnimating = false;
// 获取滑动条元素
const animationSlider = document.getElementById('animation-slider');
const progressDisplay = document.getElementById('animation-progress');
// 监听键盘按键事件
document.addEventListener('keydown', (event) => {
  // 获取当前滑动条值
  let currentValue = parseInt(animationSlider.value);
  const step = 1; // 每次按键的步长
  const min = parseInt(animationSlider.min);
  const max = parseInt(animationSlider.max);

  // 根据按下的键调整值
  if (event.key === 'ArrowUp') {
    // 上方向键 - 减小滑动条值
    currentValue = Math.max(min, currentValue - step);
    event.preventDefault(); // 阻止页面滚动
  } else if (event.key === 'ArrowDown') {
    // 下方向键 - 增大滑动条值
    currentValue = Math.min(max, currentValue + step);
    event.preventDefault(); // 阻止页面滚动
  } else {
    // 不是方向键则不处理
    return;
  }

  // 更新滑动条值和显示
  animationSlider.value = currentValue;
  const percentage = Math.round((currentValue / max) * 100);
  progressDisplay.textContent = `${percentage}%`;

  // 触发滑动条的input事件（如果原代码中有监听该事件来控制动画）
  const inputEvent = new Event('input');
  animationSlider.dispatchEvent(inputEvent);
});

// 鼠标相关全局变量
let isLeftMouseDown = false; // 左键按下
let isMovedDuringLMD = false; // （最近一次）左键按下后有没有发生移动
let initxLMD = 0.0, inityLMD = 0.0; // （最近一次）左键按下的位置
let moveDistanceLMD = 0.0; // （最近一次）左键按下后移动的矢量距离
// 监听鼠标按下事件
document.addEventListener('mousedown', (e) => {
  // e.button === 0 表示左键（标准浏览器）
  if (e.button === 0) {
    isLeftMouseDown = true;
    isMovedDuringLMD = false;
    initxLMD = e.x, inityLMD = e.y;
    moveDistanceLMD = 0;
    console.log('左键按下');
  }
});
// 监听鼠标释放事件
document.addEventListener('mouseup', (e) => {
  // 释放左键时重置状态
  if (e.button === 0) {
    isLeftMouseDown = false;
    console.log('左键释放');
  }
});
// 监听鼠标移动事件
document.addEventListener('mousemove', (e) => {
  if (isLeftMouseDown) {
    isMovedDuringLMD = true;
    var dist = (e.x-initxLMD)*(e.x-initxLMD) + (e.y-inityLMD)*(e.y-inityLMD);
    moveDistanceLMD = (moveDistanceLMD < dist ? dist : moveDistanceLMD);
  }
});
// 监听鼠标离开窗口事件（防止鼠标在窗口外释放导致状态错误）
document.addEventListener('mouseleave', () => {
  isLeftMouseDown = false;
  isMovedDuringLMD = false;
  initxLMD = 0, inityLMD = 0;
  moveDistanceLMD = 100;
});

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

    // 新增：初始化CSS2D渲染器（用于文本标注）
    // 先检查 THREE.CSS2DRenderer 是否存在（防护）
    if (!THREE.CSS2DRenderer) {
        console.error('CSS2DRenderer 未正确加载，请检查引入脚本');
    } else {
        // 2. 实例化（0.132.2 版本的正确写法）
        css2DRenderer = new THREE.CSS2DRenderer();
        css2DRenderer.setSize(window.innerWidth, window.innerHeight);
        // 3. 样式设置（0.132.2 版本兼容这些属性）
        css2DRenderer.domElement.style.position = 'absolute';
        css2DRenderer.domElement.style.top = '0';
        css2DRenderer.domElement.style.pointerEvents = 'none'; // 不阻挡鼠标交互
        document.getElementById('container').appendChild(css2DRenderer.domElement);
    }

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

// 创建透明盒子（含高度刻度线+文本标注）
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
    transparentBox.rotation.x = Math.PI / 2; // 圆柱绕X轴旋转90度 → 原Z轴变为Y轴

    const targetWorldPos = new THREE.Vector3(0, 0, 0);
    transparentBox.parent = sceneContainer;
    transparentBox.worldToLocal(targetWorldPos);
    transparentBox.position.copy(targetWorldPos);

    sceneContainer.add(transparentBox);

    // ========== 新增：高度刻度线 ==========
    // 核心注意：圆柱旋转了Math.PI/2（X轴），原Cylinder的高度方向（Z轴）变为Y轴
    // 刻度位置：1400/1000/600（基于圆柱高度方向的绝对位置）
    const heightMarks = [1400, 1000, 600, 1900];
    const markConfig = {
        color: 0xff0000,    // 刻度线颜色（红色）
        length: 100,        // 刻度线长度（沿X轴）
        lineWidth: 2        // 刻度线宽度
    };

    // 遍历生成每个刻度（核心修改：Z轴设为圆柱半径，贴合外壁）
    heightMarks.forEach(markValue => {
        const radius = 1500 / 2;
        const height = 1900+270;
        
        // 关键修正：竖向圆柱的高度方向 = Y 轴
        // 计算逻辑：圆柱中心在 Y=0，总高1900 → 刻度值相对中心的偏移
        var yPos = markValue - height/2; // 1400 → 1400-950=450；1000→50；600→-350
        if (markValue == 1900)yPos += 130;
        const zPos = radius + 50; // 圆柱外壁外侧50px（Z轴向外，避免被圆柱遮挡）
        const xPos = 0; // X轴居中
        
        // 1. 刻度线（竖向圆柱的刻度线：沿X轴横向，Y轴是高度）
        const markGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-100, yPos, zPos),  // 刻度线左端点
            new THREE.Vector3(100, yPos, zPos)    // 刻度线右端点（横向刻度，贴合竖向圆柱）
        ]);
        const markMaterial = new THREE.LineBasicMaterial({ 
            color: markConfig.color,
            lineWidth: markConfig.lineWidth
        });
        const markLine = new THREE.Line(markGeometry, markMaterial);
        transparentBox.add(markLine);

        // 2. 文本标注（在刻度线右侧，竖向排列）
        const textDiv = document.createElement('div');
        textDiv.style.color = '#ff0000';
        textDiv.style.fontSize = '16px';
        textDiv.style.fontWeight = 'bold';
        textDiv.style.textShadow = '1px 1px 2px #000';
        textDiv.textContent = markValue;
        // 可选：让文本竖向显示（如果需要）
        // textDiv.style.writingMode = 'vertical-rl';

        const textLabel = new THREE.CSS2DObject(textDiv);
        // 文本位置：刻度线右侧（X轴+80），Y轴和刻度线一致，Z轴贴外壁
        textLabel.position.set(80, yPos, zPos);
        transparentBox.add(textLabel);

        // 日志：验证坐标
        console.log(`刻度${markValue}：Y=${yPos}（高度），Z=${zPos}（径向）`);
    });
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

    const boxpos = new THREE.Vector3(0, -80, 1900+230);
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
            else {
                setModelListHighlight(model, true);
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
            else {
                setModelListHighlight(model, true);
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
        // 跳过特殊模型（支柱模型）
        if (model.userData.fileName == 'pillars.obj') {
            return;
        }

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
            'pillars.obj',
            'disk600.obj',
            'disk1000.obj',
            'disk1400.obj',
        '1000_1000_1_1.obj',
'1000_1000_1_10.obj',
'1000_1000_1_11.obj',
'1000_1000_1_12.obj',
'1000_1000_1_13.obj',
'1000_1000_1_14.obj',
'1000_1000_1_15.obj',
'1000_1000_1_16.obj',
'1000_1000_1_17.obj',
'1000_1000_1_18.obj',
'1000_1000_1_19.obj',
'1000_1000_1_2.obj',
'1000_1000_1_20.obj',
'1000_1000_1_21.obj',
'1000_1000_1_22.obj',
'1000_1000_1_23.obj',
'1000_1000_1_24.obj',
'1000_1000_1_25.obj',
'1000_1000_1_26.obj',
'1000_1000_1_27.obj',
'1000_1000_1_28.obj',
'1000_1000_1_29.obj',
'1000_1000_1_3.obj',
'1000_1000_1_30.obj',
'1000_1000_1_4.obj',
'1000_1000_1_5.obj',
'1000_1000_1_6.obj',
'1000_1000_1_7.obj',
'1000_1000_1_8.obj',
'1000_1000_1_9.obj',
'1000_500_0.5_1.obj',
'1000_500_0.5_10.obj',
'1000_500_0.5_11.obj',
'1000_500_0.5_12.obj',
'1000_500_0.5_13.obj',
'1000_500_0.5_14.obj',
'1000_500_0.5_15.obj',
'1000_500_0.5_16.obj',
'1000_500_0.5_17.obj',
'1000_500_0.5_18.obj',
'1000_500_0.5_19.obj',
'1000_500_0.5_2.obj',
'1000_500_0.5_20.obj',
'1000_500_0.5_21.obj',
'1000_500_0.5_22.obj',
'1000_500_0.5_23.obj',
'1000_500_0.5_24.obj',
'1000_500_0.5_3.obj',
'1000_500_0.5_4.obj',
'1000_500_0.5_5.obj',
'1000_500_0.5_6.obj',
'1000_500_0.5_7.obj',
'1000_500_0.5_8.obj',
'1000_500_0.5_9.obj',
'1000_980_50_1.obj',
'1000_980_50_2.obj',
'100_65_60(1)_1.obj',
'100_65_60(1)_2.obj',
'100_65_60(1)_3.obj',
'100_65_60(1)_4.obj',
'100_65_60(1)_5.obj',
'100_65_60(1)_6.obj',
'100_65_60(1)_7.obj',
'100_65_60(1)_8.obj',
'100_65_60_1.obj',
'100_65_60_2.obj',
'100_65_60_3.obj',
'100_65_60_4.obj',
'110_90_80_1.obj',
'110_90_80_2.obj',
'110_90_80_3.obj',
'110_90_80_4.obj',
'110_90_80_5.obj',
'110_90_80_6.obj',
'110_90_80_7.obj',
'110_90_80_8.obj',
'115_115_10(1)_1.obj',
'115_115_10(1)_2.obj',
'115_115_10(1)_3.obj',
'115_115_10(1)_4.obj',
'115_115_10_1.obj',
'240_110_50(1)_1.obj',
'240_110_50(1)_2.obj',
'240_110_50(1)_3.obj',
'240_110_50(1)_4.obj',
'240_110_50_1.obj',
'240_110_50_2.obj',
'240_110_50_3.obj',
'240_110_50_4.obj',
'50_35_35(1)_1.obj',
'50_35_35_1.obj',
'D100_d32_54_1.obj',
'D100_d32_54_2.obj',
'D100_d32_54_3.obj',
'D100_d32_54_4.obj',
'D109.8_158_1.obj',
'D10_15(1)_1.obj',
'D10_15_1.obj',
'D12_8_1.obj',
'D12_8_10.obj',
'D12_8_100.obj',
'D12_8_11.obj',
'D12_8_12.obj',
'D12_8_13.obj',
'D12_8_14.obj',
'D12_8_15.obj',
'D12_8_16.obj',
'D12_8_17.obj',
'D12_8_18.obj',
'D12_8_19.obj',
'D12_8_2.obj',
'D12_8_20.obj',
'D12_8_21.obj',
'D12_8_22.obj',
'D12_8_23.obj',
'D12_8_24.obj',
'D12_8_25.obj',
'D12_8_26.obj',
'D12_8_27.obj',
'D12_8_28.obj',
'D12_8_29.obj',
'D12_8_3.obj',
'D12_8_30.obj',
'D12_8_31.obj',
'D12_8_32.obj',
'D12_8_33.obj',
'D12_8_34.obj',
'D12_8_35.obj',
'D12_8_36.obj',
'D12_8_37.obj',
'D12_8_38.obj',
'D12_8_39.obj',
'D12_8_4.obj',
'D12_8_40.obj',
'D12_8_41.obj',
'D12_8_42.obj',
'D12_8_43.obj',
'D12_8_44.obj',
'D12_8_45.obj',
'D12_8_46.obj',
'D12_8_47.obj',
'D12_8_48.obj',
'D12_8_49.obj',
'D12_8_5.obj',
'D12_8_50.obj',
'D12_8_51.obj',
'D12_8_52.obj',
'D12_8_53.obj',
'D12_8_54.obj',
'D12_8_55.obj',
'D12_8_56.obj',
'D12_8_57.obj',
'D12_8_58.obj',
'D12_8_59.obj',
'D12_8_6.obj',
'D12_8_60.obj',
'D12_8_61.obj',
'D12_8_62.obj',
'D12_8_63.obj',
'D12_8_64.obj',
'D12_8_65.obj',
'D12_8_66.obj',
'D12_8_67.obj',
'D12_8_68.obj',
'D12_8_69.obj',
'D12_8_7.obj',
'D12_8_70.obj',
'D12_8_71.obj',
'D12_8_72.obj',
'D12_8_73.obj',
'D12_8_74.obj',
'D12_8_75.obj',
'D12_8_76.obj',
'D12_8_77.obj',
'D12_8_78.obj',
'D12_8_79.obj',
'D12_8_8.obj',
'D12_8_80.obj',
'D12_8_81.obj',
'D12_8_82.obj',
'D12_8_83.obj',
'D12_8_84.obj',
'D12_8_85.obj',
'D12_8_86.obj',
'D12_8_87.obj',
'D12_8_88.obj',
'D12_8_89.obj',
'D12_8_9.obj',
'D12_8_90.obj',
'D12_8_91.obj',
'D12_8_92.obj',
'D12_8_93.obj',
'D12_8_94.obj',
'D12_8_95.obj',
'D12_8_96.obj',
'D12_8_97.obj',
'D12_8_98.obj',
'D12_8_99.obj',
'D142_d126_230_1.obj',
'D142_d126_230_2.obj',
'D142_d126_230_3.obj',
'D142_d126_230_4.obj',
'D142_d126_230_5.obj',
'D142_d126_230_6.obj',
'D142_d126_270_1.obj',
'D142_d126_270_2.obj',
'D142_d126_270_3.obj',
'D142_d126_270_4.obj',
'D142_d126_270_5.obj',
'D142_d126_270_6.obj',
'D142_d126_270_7.obj',
'D142_d126_270_8.obj',
'D185_d147_8_1.obj',
'D185_d147_8_10.obj',
'D185_d147_8_100.obj',
'D185_d147_8_101.obj',
'D185_d147_8_102.obj',
'D185_d147_8_103.obj',
'D185_d147_8_104.obj',
'D185_d147_8_105.obj',
'D185_d147_8_106.obj',
'D185_d147_8_107.obj',
'D185_d147_8_108.obj',
'D185_d147_8_109.obj',
'D185_d147_8_11.obj',
'D185_d147_8_110.obj',
'D185_d147_8_111.obj',
'D185_d147_8_112.obj',
'D185_d147_8_113.obj',
'D185_d147_8_114.obj',
'D185_d147_8_115.obj',
'D185_d147_8_116.obj',
'D185_d147_8_117.obj',
'D185_d147_8_118.obj',
'D185_d147_8_119.obj',
'D185_d147_8_12.obj',
'D185_d147_8_120.obj',
'D185_d147_8_121.obj',
'D185_d147_8_122.obj',
'D185_d147_8_123.obj',
'D185_d147_8_124.obj',
'D185_d147_8_125.obj',
'D185_d147_8_126.obj',
'D185_d147_8_127.obj',
'D185_d147_8_128.obj',
'D185_d147_8_129.obj',
'D185_d147_8_13.obj',
'D185_d147_8_130.obj',
'D185_d147_8_131.obj',
'D185_d147_8_132.obj',
'D185_d147_8_133.obj',
'D185_d147_8_134.obj',
'D185_d147_8_135.obj',
'D185_d147_8_136.obj',
'D185_d147_8_137.obj',
'D185_d147_8_138.obj',
'D185_d147_8_139.obj',
'D185_d147_8_14.obj',
'D185_d147_8_140.obj',
'D185_d147_8_141.obj',
'D185_d147_8_142.obj',
'D185_d147_8_143.obj',
'D185_d147_8_144.obj',
'D185_d147_8_145.obj',
'D185_d147_8_146.obj',
'D185_d147_8_147.obj',
'D185_d147_8_148.obj',
'D185_d147_8_149.obj',
'D185_d147_8_15.obj',
'D185_d147_8_150.obj',
'D185_d147_8_16.obj',
'D185_d147_8_17.obj',
'D185_d147_8_18.obj',
'D185_d147_8_19.obj',
'D185_d147_8_2.obj',
'D185_d147_8_20.obj',
'D185_d147_8_21.obj',
'D185_d147_8_22.obj',
'D185_d147_8_23.obj',
'D185_d147_8_24.obj',
'D185_d147_8_25.obj',
'D185_d147_8_26.obj',
'D185_d147_8_27.obj',
'D185_d147_8_28.obj',
'D185_d147_8_29.obj',
'D185_d147_8_3.obj',
'D185_d147_8_30.obj',
'D185_d147_8_31.obj',
'D185_d147_8_32.obj',
'D185_d147_8_33.obj',
'D185_d147_8_34.obj',
'D185_d147_8_35.obj',
'D185_d147_8_36.obj',
'D185_d147_8_37.obj',
'D185_d147_8_38.obj',
'D185_d147_8_39.obj',
'D185_d147_8_4.obj',
'D185_d147_8_40.obj',
'D185_d147_8_41.obj',
'D185_d147_8_42.obj',
'D185_d147_8_43.obj',
'D185_d147_8_44.obj',
'D185_d147_8_45.obj',
'D185_d147_8_46.obj',
'D185_d147_8_47.obj',
'D185_d147_8_48.obj',
'D185_d147_8_49.obj',
'D185_d147_8_5.obj',
'D185_d147_8_50.obj',
'D185_d147_8_51.obj',
'D185_d147_8_52.obj',
'D185_d147_8_53.obj',
'D185_d147_8_54.obj',
'D185_d147_8_55.obj',
'D185_d147_8_56.obj',
'D185_d147_8_57.obj',
'D185_d147_8_58.obj',
'D185_d147_8_59.obj',
'D185_d147_8_6.obj',
'D185_d147_8_60.obj',
'D185_d147_8_61.obj',
'D185_d147_8_62.obj',
'D185_d147_8_63.obj',
'D185_d147_8_64.obj',
'D185_d147_8_65.obj',
'D185_d147_8_66.obj',
'D185_d147_8_67.obj',
'D185_d147_8_68.obj',
'D185_d147_8_69.obj',
'D185_d147_8_7.obj',
'D185_d147_8_70.obj',
'D185_d147_8_71.obj',
'D185_d147_8_72.obj',
'D185_d147_8_73.obj',
'D185_d147_8_74.obj',
'D185_d147_8_75.obj',
'D185_d147_8_76.obj',
'D185_d147_8_77.obj',
'D185_d147_8_78.obj',
'D185_d147_8_79.obj',
'D185_d147_8_8.obj',
'D185_d147_8_80.obj',
'D185_d147_8_81.obj',
'D185_d147_8_82.obj',
'D185_d147_8_83.obj',
'D185_d147_8_84.obj',
'D185_d147_8_85.obj',
'D185_d147_8_86.obj',
'D185_d147_8_87.obj',
'D185_d147_8_88.obj',
'D185_d147_8_89.obj',
'D185_d147_8_9.obj',
'D185_d147_8_90.obj',
'D185_d147_8_91.obj',
'D185_d147_8_92.obj',
'D185_d147_8_93.obj',
'D185_d147_8_94.obj',
'D185_d147_8_95.obj',
'D185_d147_8_96.obj',
'D185_d147_8_97.obj',
'D185_d147_8_98.obj',
'D185_d147_8_99.obj',
'D187_9_1.obj',
'D187_9_10.obj',
'D187_9_11.obj',
'D187_9_12.obj',
'D187_9_13.obj',
'D187_9_14.obj',
'D187_9_15.obj',
'D187_9_16.obj',
'D187_9_17.obj',
'D187_9_18.obj',
'D187_9_19.obj',
'D187_9_2.obj',
'D187_9_20.obj',
'D187_9_21.obj',
'D187_9_22.obj',
'D187_9_23.obj',
'D187_9_24.obj',
'D187_9_25.obj',
'D187_9_26.obj',
'D187_9_27.obj',
'D187_9_28.obj',
'D187_9_29.obj',
'D187_9_3.obj',
'D187_9_30.obj',
'D187_9_31.obj',
'D187_9_32.obj',
'D187_9_33.obj',
'D187_9_34.obj',
'D187_9_35.obj',
'D187_9_36.obj',
'D187_9_37.obj',
'D187_9_38.obj',
'D187_9_39.obj',
'D187_9_4.obj',
'D187_9_40.obj',
'D187_9_41.obj',
'D187_9_42.obj',
'D187_9_43.obj',
'D187_9_44.obj',
'D187_9_45.obj',
'D187_9_46.obj',
'D187_9_47.obj',
'D187_9_48.obj',
'D187_9_49.obj',
'D187_9_5.obj',
'D187_9_50.obj',
'D187_9_51.obj',
'D187_9_52.obj',
'D187_9_53.obj',
'D187_9_54.obj',
'D187_9_55.obj',
'D187_9_56.obj',
'D187_9_57.obj',
'D187_9_58.obj',
'D187_9_59.obj',
'D187_9_6.obj',
'D187_9_60.obj',
'D187_9_7.obj',
'D187_9_8.obj',
'D187_9_9.obj',
'D217_d100_4_1.obj',
'D217_d100_4_10.obj',
'D217_d100_4_11.obj',
'D217_d100_4_12.obj',
'D217_d100_4_13.obj',
'D217_d100_4_14.obj',
'D217_d100_4_15.obj',
'D217_d100_4_16.obj',
'D217_d100_4_17.obj',
'D217_d100_4_18.obj',
'D217_d100_4_19.obj',
'D217_d100_4_2.obj',
'D217_d100_4_20.obj',
'D217_d100_4_21.obj',
'D217_d100_4_22.obj',
'D217_d100_4_23.obj',
'D217_d100_4_24.obj',
'D217_d100_4_25.obj',
'D217_d100_4_26.obj',
'D217_d100_4_27.obj',
'D217_d100_4_28.obj',
'D217_d100_4_29.obj',
'D217_d100_4_3.obj',
'D217_d100_4_30.obj',
'D217_d100_4_31.obj',
'D217_d100_4_32.obj',
'D217_d100_4_33.obj',
'D217_d100_4_34.obj',
'D217_d100_4_35.obj',
'D217_d100_4_36.obj',
'D217_d100_4_37.obj',
'D217_d100_4_38.obj',
'D217_d100_4_39.obj',
'D217_d100_4_4.obj',
'D217_d100_4_40.obj',
'D217_d100_4_41.obj',
'D217_d100_4_42.obj',
'D217_d100_4_5.obj',
'D217_d100_4_6.obj',
'D217_d100_4_7.obj',
'D217_d100_4_8.obj',
'D217_d100_4_9.obj',
'D218_d212_61.9_1.obj',
'D218_d212_61.9_10.obj',
'D218_d212_61.9_11.obj',
'D218_d212_61.9_12.obj',
'D218_d212_61.9_13.obj',
'D218_d212_61.9_14.obj',
'D218_d212_61.9_15.obj',
'D218_d212_61.9_16.obj',
'D218_d212_61.9_17.obj',
'D218_d212_61.9_18.obj',
'D218_d212_61.9_19.obj',
'D218_d212_61.9_2.obj',
'D218_d212_61.9_20.obj',
'D218_d212_61.9_21.obj',
'D218_d212_61.9_22.obj',
'D218_d212_61.9_23.obj',
'D218_d212_61.9_24.obj',
'D218_d212_61.9_25.obj',
'D218_d212_61.9_26.obj',
'D218_d212_61.9_27.obj',
'D218_d212_61.9_28.obj',
'D218_d212_61.9_29.obj',
'D218_d212_61.9_3.obj',
'D218_d212_61.9_30.obj',
'D218_d212_61.9_31.obj',
'D218_d212_61.9_32.obj',
'D218_d212_61.9_33.obj',
'D218_d212_61.9_34.obj',
'D218_d212_61.9_35.obj',
'D218_d212_61.9_36.obj',
'D218_d212_61.9_37.obj',
'D218_d212_61.9_38.obj',
'D218_d212_61.9_39.obj',
'D218_d212_61.9_4.obj',
'D218_d212_61.9_40.obj',
'D218_d212_61.9_41.obj',
'D218_d212_61.9_42.obj',
'D218_d212_61.9_43.obj',
'D218_d212_61.9_44.obj',
'D218_d212_61.9_45.obj',
'D218_d212_61.9_46.obj',
'D218_d212_61.9_47.obj',
'D218_d212_61.9_48.obj',
'D218_d212_61.9_49.obj',
'D218_d212_61.9_5.obj',
'D218_d212_61.9_50.obj',
'D218_d212_61.9_51.obj',
'D218_d212_61.9_52.obj',
'D218_d212_61.9_53.obj',
'D218_d212_61.9_54.obj',
'D218_d212_61.9_55.obj',
'D218_d212_61.9_56.obj',
'D218_d212_61.9_57.obj',
'D218_d212_61.9_58.obj',
'D218_d212_61.9_59.obj',
'D218_d212_61.9_6.obj',
'D218_d212_61.9_60.obj',
'D218_d212_61.9_61.obj',
'D218_d212_61.9_62.obj',
'D218_d212_61.9_63.obj',
'D218_d212_61.9_64.obj',
'D218_d212_61.9_65.obj',
'D218_d212_61.9_66.obj',
'D218_d212_61.9_67.obj',
'D218_d212_61.9_68.obj',
'D218_d212_61.9_69.obj',
'D218_d212_61.9_7.obj',
'D218_d212_61.9_70.obj',
'D218_d212_61.9_71.obj',
'D218_d212_61.9_72.obj',
'D218_d212_61.9_73.obj',
'D218_d212_61.9_74.obj',
'D218_d212_61.9_75.obj',
'D218_d212_61.9_76.obj',
'D218_d212_61.9_77.obj',
'D218_d212_61.9_78.obj',
'D218_d212_61.9_79.obj',
'D218_d212_61.9_8.obj',
'D218_d212_61.9_80.obj',
'D218_d212_61.9_81.obj',
'D218_d212_61.9_82.obj',
'D218_d212_61.9_83.obj',
'D218_d212_61.9_84.obj',
'D218_d212_61.9_85.obj',
'D218_d212_61.9_9.obj',
'D219.3_d156_9_1.obj',
'D219.3_d156_9_10.obj',
'D219.3_d156_9_2.obj',
'D219.3_d156_9_3.obj',
'D219.3_d156_9_4.obj',
'D219.3_d156_9_5.obj',
'D219.3_d156_9_6.obj',
'D219.3_d156_9_7.obj',
'D219.3_d156_9_8.obj',
'D219.3_d156_9_9.obj',
'D220_29.8_1.obj',
'D220_29.8_10.obj',
'D220_29.8_11.obj',
'D220_29.8_12.obj',
'D220_29.8_2.obj',
'D220_29.8_3.obj',
'D220_29.8_4.obj',
'D220_29.8_5.obj',
'D220_29.8_6.obj',
'D220_29.8_7.obj',
'D220_29.8_8.obj',
'D220_29.8_9.obj',
'D225.6_d178_35.8_1.obj',
'D225.6_d178_35.8_2.obj',
'D225.6_d178_35.8_3.obj',
'D225.6_d178_35.8_4.obj',
'D225.6_d178_35.8_5.obj',
'D225.6_d178_35.8_6.obj',
'D225_2.5_1.obj',
'D225_2.5_2.obj',
'D225_2.5_3.obj',
'D225_2.5_4.obj',
'D225_2.5_5.obj',
'D225_2.5_6.obj',
'D225_2.5_7.obj',
'D227.7_d207.5_29_1.obj',
'D227.7_d207.5_29_2.obj',
'D227.7_d207.5_29_3.obj',
'D227.7_d207.5_29_4.obj',
'D227.7_d207.5_29_5.obj',
'D227.7_d207.5_29_6.obj',
'D227.7_d207.5_29_7.obj',
'D227.7_d207.5_29_8.obj',
'D240_d200_45_1.obj',
'D240_d200_45_10.obj',
'D240_d200_45_11.obj',
'D240_d200_45_12.obj',
'D240_d200_45_13.obj',
'D240_d200_45_14.obj',
'D240_d200_45_15.obj',
'D240_d200_45_16.obj',
'D240_d200_45_17.obj',
'D240_d200_45_18.obj',
'D240_d200_45_2.obj',
'D240_d200_45_3.obj',
'D240_d200_45_4.obj',
'D240_d200_45_5.obj',
'D240_d200_45_6.obj',
'D240_d200_45_7.obj',
'D240_d200_45_8.obj',
'D240_d200_45_9.obj',
'D240_d204.1_78_1.obj',
'D240_d204.1_78_10.obj',
'D240_d204.1_78_11.obj',
'D240_d204.1_78_12.obj',
'D240_d204.1_78_13.obj',
'D240_d204.1_78_14.obj',
'D240_d204.1_78_15.obj',
'D240_d204.1_78_16.obj',
'D240_d204.1_78_17.obj',
'D240_d204.1_78_2.obj',
'D240_d204.1_78_3.obj',
'D240_d204.1_78_4.obj',
'D240_d204.1_78_5.obj',
'D240_d204.1_78_6.obj',
'D240_d204.1_78_7.obj',
'D240_d204.1_78_8.obj',
'D240_d204.1_78_9.obj',
'D249.95_d213_5_1.obj',
'D249.95_d213_5_2.obj',
'D249.95_d213_5_3.obj',
'D249.95_d213_5_4.obj',
'D250_d223.2_2.5_1.obj',
'D250_d223.2_2.5_2.obj',
'D252_d23_64_1.obj',
'D254_d234_40(1)_1.obj',
'D254_d234_40(1)_2.obj',
'D254_d234_40(1)_3.obj',
'D254_d234_40_1.obj',
'D254_d234_40_2.obj',
'D254_d234_40_3.obj',
'D258_M40_62_1.obj',
'D291.8_d278_100_1.obj',
'D291.8_d278_100_10.obj',
'D291.8_d278_100_11.obj',
'D291.8_d278_100_12.obj',
'D291.8_d278_100_13.obj',
'D291.8_d278_100_14.obj',
'D291.8_d278_100_15.obj',
'D291.8_d278_100_16.obj',
'D291.8_d278_100_17.obj',
'D291.8_d278_100_18.obj',
'D291.8_d278_100_19.obj',
'D291.8_d278_100_2.obj',
'D291.8_d278_100_20.obj',
'D291.8_d278_100_21.obj',
'D291.8_d278_100_22.obj',
'D291.8_d278_100_23.obj',
'D291.8_d278_100_24.obj',
'D291.8_d278_100_25.obj',
'D291.8_d278_100_26.obj',
'D291.8_d278_100_27.obj',
'D291.8_d278_100_28.obj',
'D291.8_d278_100_29.obj',
'D291.8_d278_100_3.obj',
'D291.8_d278_100_30.obj',
'D291.8_d278_100_31.obj',
'D291.8_d278_100_32.obj',
'D291.8_d278_100_33.obj',
'D291.8_d278_100_34.obj',
'D291.8_d278_100_35.obj',
'D291.8_d278_100_36.obj',
'D291.8_d278_100_37.obj',
'D291.8_d278_100_38.obj',
'D291.8_d278_100_39.obj',
'D291.8_d278_100_4.obj',
'D291.8_d278_100_40.obj',
'D291.8_d278_100_5.obj',
'D291.8_d278_100_6.obj',
'D291.8_d278_100_7.obj',
'D291.8_d278_100_8.obj',
'D291.8_d278_100_9.obj',
'D470_d430_170_1.obj',
'D470_d430_170_2.obj',
'D600_d561.5_100_1.obj',
'D60_356_1.obj',
'D60_356_10.obj',
'D60_356_11.obj',
'D60_356_12.obj',
'D60_356_13.obj',
'D60_356_14.obj',
'D60_356_15.obj',
'D60_356_16.obj',
'D60_356_17.obj',
'D60_356_18.obj',
'D60_356_2.obj',
'D60_356_3.obj',
'D60_356_4.obj',
'D60_356_5.obj',
'D60_356_6.obj',
'D60_356_7.obj',
'D60_356_8.obj',
'D60_356_9.obj',
'D78_d71_214_1.obj',
'D78_d71_214_2.obj',
'D78_d71_214_3.obj',
'D78_d71_214_4.obj',
'D820_d794_550_1.obj',
'D890_d870_370_1.obj',
'D890_d870_560_1.obj'
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
                    // console.log(fileName);

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
    if (isLeftMouseDown) return; // 拖动时不进行交互

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
    // 点击过程中发生移动，说明用户在拖动画面，不进行点击事件交互处理
    console.log(moveDistanceLMD);
    if (isMovedDuringLMD && moveDistanceLMD>0) return;

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
    // 同步更新CSS2D渲染器尺寸
    if (css2DRenderer) {
        css2DRenderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// 渲染循环
function animate() {
    requestAnimationFrame(animate);
    orbitControls.update();
    renderer.render(scene, camera);
    // 渲染CSS2D标签（文本标注）
    if (css2DRenderer) {
        css2DRenderer.render(scene, camera);
    }
}

// 启动应用
window.addEventListener('load', initScene);
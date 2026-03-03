// 全局变量定义（新增 sceneContainer 和物料列表相关变量）
let scene, camera, renderer, raycaster, mouse, orbitControls;
let transparentBox, allModels = [];
const OBJECT_DIR = './Objects5/';
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
        '25_25_10_1.obj',
'50_35_35_1.obj',
'50_35_35_2.obj',
'50_35_35_3.obj',
'50_35_35_4.obj',
'50_50_30_1.obj',
'D180_7_1.obj',
'D180_7_10.obj',
'D180_7_11.obj',
'D180_7_12.obj',
'D180_7_13.obj',
'D180_7_14.obj',
'D180_7_15.obj',
'D180_7_16.obj',
'D180_7_17.obj',
'D180_7_18.obj',
'D180_7_19.obj',
'D180_7_2.obj',
'D180_7_20.obj',
'D180_7_21.obj',
'D180_7_22.obj',
'D180_7_23.obj',
'D180_7_24.obj',
'D180_7_25.obj',
'D180_7_26.obj',
'D180_7_27.obj',
'D180_7_28.obj',
'D180_7_29.obj',
'D180_7_3.obj',
'D180_7_30.obj',
'D180_7_31.obj',
'D180_7_32.obj',
'D180_7_33.obj',
'D180_7_34.obj',
'D180_7_35.obj',
'D180_7_36.obj',
'D180_7_37.obj',
'D180_7_38.obj',
'D180_7_39.obj',
'D180_7_4.obj',
'D180_7_40.obj',
'D180_7_5.obj',
'D180_7_6.obj',
'D180_7_7.obj',
'D180_7_8.obj',
'D180_7_9.obj',
'D181_d174_20_1.obj',
'D181_d174_20_10.obj',
'D181_d174_20_100.obj',
'D181_d174_20_101.obj',
'D181_d174_20_102.obj',
'D181_d174_20_103.obj',
'D181_d174_20_104.obj',
'D181_d174_20_105.obj',
'D181_d174_20_106.obj',
'D181_d174_20_107.obj',
'D181_d174_20_108.obj',
'D181_d174_20_109.obj',
'D181_d174_20_11.obj',
'D181_d174_20_110.obj',
'D181_d174_20_111.obj',
'D181_d174_20_112.obj',
'D181_d174_20_113.obj',
'D181_d174_20_114.obj',
'D181_d174_20_115.obj',
'D181_d174_20_116.obj',
'D181_d174_20_117.obj',
'D181_d174_20_118.obj',
'D181_d174_20_119.obj',
'D181_d174_20_12.obj',
'D181_d174_20_120.obj',
'D181_d174_20_121.obj',
'D181_d174_20_122.obj',
'D181_d174_20_123.obj',
'D181_d174_20_124.obj',
'D181_d174_20_125.obj',
'D181_d174_20_126.obj',
'D181_d174_20_127.obj',
'D181_d174_20_128.obj',
'D181_d174_20_129.obj',
'D181_d174_20_13.obj',
'D181_d174_20_130.obj',
'D181_d174_20_131.obj',
'D181_d174_20_132.obj',
'D181_d174_20_133.obj',
'D181_d174_20_134.obj',
'D181_d174_20_135.obj',
'D181_d174_20_136.obj',
'D181_d174_20_137.obj',
'D181_d174_20_138.obj',
'D181_d174_20_139.obj',
'D181_d174_20_14.obj',
'D181_d174_20_140.obj',
'D181_d174_20_141.obj',
'D181_d174_20_142.obj',
'D181_d174_20_143.obj',
'D181_d174_20_144.obj',
'D181_d174_20_145.obj',
'D181_d174_20_146.obj',
'D181_d174_20_147.obj',
'D181_d174_20_148.obj',
'D181_d174_20_149.obj',
'D181_d174_20_15.obj',
'D181_d174_20_150.obj',
'D181_d174_20_151.obj',
'D181_d174_20_152.obj',
'D181_d174_20_153.obj',
'D181_d174_20_154.obj',
'D181_d174_20_155.obj',
'D181_d174_20_156.obj',
'D181_d174_20_157.obj',
'D181_d174_20_158.obj',
'D181_d174_20_159.obj',
'D181_d174_20_16.obj',
'D181_d174_20_160.obj',
'D181_d174_20_161.obj',
'D181_d174_20_162.obj',
'D181_d174_20_163.obj',
'D181_d174_20_164.obj',
'D181_d174_20_165.obj',
'D181_d174_20_166.obj',
'D181_d174_20_167.obj',
'D181_d174_20_168.obj',
'D181_d174_20_169.obj',
'D181_d174_20_17.obj',
'D181_d174_20_170.obj',
'D181_d174_20_171.obj',
'D181_d174_20_172.obj',
'D181_d174_20_173.obj',
'D181_d174_20_174.obj',
'D181_d174_20_175.obj',
'D181_d174_20_176.obj',
'D181_d174_20_177.obj',
'D181_d174_20_178.obj',
'D181_d174_20_179.obj',
'D181_d174_20_18.obj',
'D181_d174_20_180.obj',
'D181_d174_20_181.obj',
'D181_d174_20_182.obj',
'D181_d174_20_183.obj',
'D181_d174_20_184.obj',
'D181_d174_20_185.obj',
'D181_d174_20_186.obj',
'D181_d174_20_187.obj',
'D181_d174_20_188.obj',
'D181_d174_20_189.obj',
'D181_d174_20_19.obj',
'D181_d174_20_190.obj',
'D181_d174_20_191.obj',
'D181_d174_20_192.obj',
'D181_d174_20_193.obj',
'D181_d174_20_194.obj',
'D181_d174_20_195.obj',
'D181_d174_20_196.obj',
'D181_d174_20_197.obj',
'D181_d174_20_198.obj',
'D181_d174_20_199.obj',
'D181_d174_20_2.obj',
'D181_d174_20_20.obj',
'D181_d174_20_200.obj',
'D181_d174_20_21.obj',
'D181_d174_20_22.obj',
'D181_d174_20_23.obj',
'D181_d174_20_24.obj',
'D181_d174_20_25.obj',
'D181_d174_20_26.obj',
'D181_d174_20_27.obj',
'D181_d174_20_28.obj',
'D181_d174_20_29.obj',
'D181_d174_20_3.obj',
'D181_d174_20_30.obj',
'D181_d174_20_31.obj',
'D181_d174_20_32.obj',
'D181_d174_20_33.obj',
'D181_d174_20_34.obj',
'D181_d174_20_35.obj',
'D181_d174_20_36.obj',
'D181_d174_20_37.obj',
'D181_d174_20_38.obj',
'D181_d174_20_39.obj',
'D181_d174_20_4.obj',
'D181_d174_20_40.obj',
'D181_d174_20_41.obj',
'D181_d174_20_42.obj',
'D181_d174_20_43.obj',
'D181_d174_20_44.obj',
'D181_d174_20_45.obj',
'D181_d174_20_46.obj',
'D181_d174_20_47.obj',
'D181_d174_20_48.obj',
'D181_d174_20_49.obj',
'D181_d174_20_5.obj',
'D181_d174_20_50.obj',
'D181_d174_20_51.obj',
'D181_d174_20_52.obj',
'D181_d174_20_53.obj',
'D181_d174_20_54.obj',
'D181_d174_20_55.obj',
'D181_d174_20_56.obj',
'D181_d174_20_57.obj',
'D181_d174_20_58.obj',
'D181_d174_20_59.obj',
'D181_d174_20_6.obj',
'D181_d174_20_60.obj',
'D181_d174_20_61.obj',
'D181_d174_20_62.obj',
'D181_d174_20_63.obj',
'D181_d174_20_64.obj',
'D181_d174_20_65.obj',
'D181_d174_20_66.obj',
'D181_d174_20_67.obj',
'D181_d174_20_68.obj',
'D181_d174_20_69.obj',
'D181_d174_20_7.obj',
'D181_d174_20_70.obj',
'D181_d174_20_71.obj',
'D181_d174_20_72.obj',
'D181_d174_20_73.obj',
'D181_d174_20_74.obj',
'D181_d174_20_75.obj',
'D181_d174_20_76.obj',
'D181_d174_20_77.obj',
'D181_d174_20_78.obj',
'D181_d174_20_79.obj',
'D181_d174_20_8.obj',
'D181_d174_20_80.obj',
'D181_d174_20_81.obj',
'D181_d174_20_82.obj',
'D181_d174_20_83.obj',
'D181_d174_20_84.obj',
'D181_d174_20_85.obj',
'D181_d174_20_86.obj',
'D181_d174_20_87.obj',
'D181_d174_20_88.obj',
'D181_d174_20_89.obj',
'D181_d174_20_9.obj',
'D181_d174_20_90.obj',
'D181_d174_20_91.obj',
'D181_d174_20_92.obj',
'D181_d174_20_93.obj',
'D181_d174_20_94.obj',
'D181_d174_20_95.obj',
'D181_d174_20_96.obj',
'D181_d174_20_97.obj',
'D181_d174_20_98.obj',
'D181_d174_20_99.obj',
'D213_35(1)_1.obj',
'D213_35(1)_2.obj',
'D213_35(1)_3.obj',
'D213_35(1)_4.obj',
'D213_35(1)_5.obj',
'D213_35(1)_6.obj',
'D213_35_1.obj',
'D213_35_10.obj',
'D213_35_11.obj',
'D213_35_12.obj',
'D213_35_13.obj',
'D213_35_14.obj',
'D213_35_15.obj',
'D213_35_16.obj',
'D213_35_17.obj',
'D213_35_18.obj',
'D213_35_19.obj',
'D213_35_2.obj',
'D213_35_20.obj',
'D213_35_3.obj',
'D213_35_4.obj',
'D213_35_5.obj',
'D213_35_6.obj',
'D213_35_7.obj',
'D213_35_8.obj',
'D213_35_9.obj',
'D213_d203_43_1.obj',
'D213_d203_43_10.obj',
'D213_d203_43_11.obj',
'D213_d203_43_12.obj',
'D213_d203_43_13.obj',
'D213_d203_43_14.obj',
'D213_d203_43_15.obj',
'D213_d203_43_16.obj',
'D213_d203_43_17.obj',
'D213_d203_43_18.obj',
'D213_d203_43_19.obj',
'D213_d203_43_2.obj',
'D213_d203_43_20.obj',
'D213_d203_43_21.obj',
'D213_d203_43_22.obj',
'D213_d203_43_23.obj',
'D213_d203_43_24.obj',
'D213_d203_43_25.obj',
'D213_d203_43_26.obj',
'D213_d203_43_3.obj',
'D213_d203_43_4.obj',
'D213_d203_43_5.obj',
'D213_d203_43_6.obj',
'D213_d203_43_7.obj',
'D213_d203_43_8.obj',
'D213_d203_43_9.obj',
'D213_d203_57_1.obj',
'D213_d203_57_2.obj',
'D213_d203_57_3.obj',
'D213_d203_57_4.obj',
'D213_d203_57_5.obj',
'D218_35_1.obj',
'D218_35_2.obj',
'D218_35_3.obj',
'D218_35_4.obj',
'D218_35_5.obj',
'D218_35_6.obj',
'D218_d208_43_1.obj',
'D218_d208_43_2.obj',
'D218_d208_43_3.obj',
'D218_d208_43_4.obj',
'D218_d208_43_5.obj',
'D218_d208_43_6.obj',
'D220_d204_24_1.obj',
'D220_d204_24_2.obj',
'D225_3.5_1.obj',
'D225_3.5_2.obj',
'D225_3.5_3.obj',
'D225_3.5_4.obj',
'D225_3.5_5.obj',
'D225_3.5_6.obj',
'D22_20_1.obj',
'D22_20_10.obj',
'D22_20_100.obj',
'D22_20_101.obj',
'D22_20_102.obj',
'D22_20_103.obj',
'D22_20_104.obj',
'D22_20_105.obj',
'D22_20_106.obj',
'D22_20_107.obj',
'D22_20_108.obj',
'D22_20_109.obj',
'D22_20_11.obj',
'D22_20_110.obj',
'D22_20_111.obj',
'D22_20_112.obj',
'D22_20_113.obj',
'D22_20_114.obj',
'D22_20_115.obj',
'D22_20_116.obj',
'D22_20_117.obj',
'D22_20_118.obj',
'D22_20_119.obj',
'D22_20_12.obj',
'D22_20_120.obj',
'D22_20_121.obj',
'D22_20_122.obj',
'D22_20_123.obj',
'D22_20_124.obj',
'D22_20_125.obj',
'D22_20_126.obj',
'D22_20_127.obj',
'D22_20_128.obj',
'D22_20_129.obj',
'D22_20_13.obj',
'D22_20_130.obj',
'D22_20_131.obj',
'D22_20_132.obj',
'D22_20_133.obj',
'D22_20_134.obj',
'D22_20_135.obj',
'D22_20_136.obj',
'D22_20_137.obj',
'D22_20_138.obj',
'D22_20_139.obj',
'D22_20_14.obj',
'D22_20_140.obj',
'D22_20_141.obj',
'D22_20_142.obj',
'D22_20_143.obj',
'D22_20_144.obj',
'D22_20_145.obj',
'D22_20_146.obj',
'D22_20_147.obj',
'D22_20_148.obj',
'D22_20_149.obj',
'D22_20_15.obj',
'D22_20_150.obj',
'D22_20_151.obj',
'D22_20_152.obj',
'D22_20_153.obj',
'D22_20_154.obj',
'D22_20_155.obj',
'D22_20_156.obj',
'D22_20_157.obj',
'D22_20_158.obj',
'D22_20_159.obj',
'D22_20_16.obj',
'D22_20_160.obj',
'D22_20_161.obj',
'D22_20_162.obj',
'D22_20_163.obj',
'D22_20_164.obj',
'D22_20_165.obj',
'D22_20_166.obj',
'D22_20_167.obj',
'D22_20_168.obj',
'D22_20_169.obj',
'D22_20_17.obj',
'D22_20_170.obj',
'D22_20_171.obj',
'D22_20_172.obj',
'D22_20_173.obj',
'D22_20_174.obj',
'D22_20_175.obj',
'D22_20_176.obj',
'D22_20_177.obj',
'D22_20_178.obj',
'D22_20_179.obj',
'D22_20_18.obj',
'D22_20_180.obj',
'D22_20_181.obj',
'D22_20_182.obj',
'D22_20_183.obj',
'D22_20_184.obj',
'D22_20_185.obj',
'D22_20_186.obj',
'D22_20_187.obj',
'D22_20_188.obj',
'D22_20_189.obj',
'D22_20_19.obj',
'D22_20_190.obj',
'D22_20_191.obj',
'D22_20_192.obj',
'D22_20_193.obj',
'D22_20_194.obj',
'D22_20_195.obj',
'D22_20_196.obj',
'D22_20_197.obj',
'D22_20_198.obj',
'D22_20_199.obj',
'D22_20_2.obj',
'D22_20_20.obj',
'D22_20_200.obj',
'D22_20_201.obj',
'D22_20_202.obj',
'D22_20_203.obj',
'D22_20_204.obj',
'D22_20_205.obj',
'D22_20_206.obj',
'D22_20_207.obj',
'D22_20_208.obj',
'D22_20_209.obj',
'D22_20_21.obj',
'D22_20_210.obj',
'D22_20_211.obj',
'D22_20_212.obj',
'D22_20_213.obj',
'D22_20_214.obj',
'D22_20_215.obj',
'D22_20_216.obj',
'D22_20_217.obj',
'D22_20_218.obj',
'D22_20_219.obj',
'D22_20_22.obj',
'D22_20_220.obj',
'D22_20_221.obj',
'D22_20_222.obj',
'D22_20_223.obj',
'D22_20_224.obj',
'D22_20_225.obj',
'D22_20_226.obj',
'D22_20_227.obj',
'D22_20_228.obj',
'D22_20_229.obj',
'D22_20_23.obj',
'D22_20_230.obj',
'D22_20_231.obj',
'D22_20_232.obj',
'D22_20_233.obj',
'D22_20_234.obj',
'D22_20_235.obj',
'D22_20_236.obj',
'D22_20_237.obj',
'D22_20_238.obj',
'D22_20_239.obj',
'D22_20_24.obj',
'D22_20_240.obj',
'D22_20_241.obj',
'D22_20_242.obj',
'D22_20_243.obj',
'D22_20_244.obj',
'D22_20_245.obj',
'D22_20_246.obj',
'D22_20_247.obj',
'D22_20_248.obj',
'D22_20_249.obj',
'D22_20_25.obj',
'D22_20_250.obj',
'D22_20_251.obj',
'D22_20_252.obj',
'D22_20_253.obj',
'D22_20_254.obj',
'D22_20_255.obj',
'D22_20_256.obj',
'D22_20_257.obj',
'D22_20_258.obj',
'D22_20_259.obj',
'D22_20_26.obj',
'D22_20_260.obj',
'D22_20_261.obj',
'D22_20_262.obj',
'D22_20_263.obj',
'D22_20_264.obj',
'D22_20_265.obj',
'D22_20_266.obj',
'D22_20_267.obj',
'D22_20_268.obj',
'D22_20_269.obj',
'D22_20_27.obj',
'D22_20_270.obj',
'D22_20_271.obj',
'D22_20_272.obj',
'D22_20_273.obj',
'D22_20_274.obj',
'D22_20_275.obj',
'D22_20_276.obj',
'D22_20_277.obj',
'D22_20_278.obj',
'D22_20_279.obj',
'D22_20_28.obj',
'D22_20_280.obj',
'D22_20_281.obj',
'D22_20_282.obj',
'D22_20_283.obj',
'D22_20_284.obj',
'D22_20_285.obj',
'D22_20_286.obj',
'D22_20_287.obj',
'D22_20_288.obj',
'D22_20_289.obj',
'D22_20_29.obj',
'D22_20_290.obj',
'D22_20_291.obj',
'D22_20_292.obj',
'D22_20_293.obj',
'D22_20_294.obj',
'D22_20_295.obj',
'D22_20_296.obj',
'D22_20_297.obj',
'D22_20_298.obj',
'D22_20_299.obj',
'D22_20_3.obj',
'D22_20_30.obj',
'D22_20_300.obj',
'D22_20_31.obj',
'D22_20_32.obj',
'D22_20_33.obj',
'D22_20_34.obj',
'D22_20_35.obj',
'D22_20_36.obj',
'D22_20_37.obj',
'D22_20_38.obj',
'D22_20_39.obj',
'D22_20_4.obj',
'D22_20_40.obj',
'D22_20_41.obj',
'D22_20_42.obj',
'D22_20_43.obj',
'D22_20_44.obj',
'D22_20_45.obj',
'D22_20_46.obj',
'D22_20_47.obj',
'D22_20_48.obj',
'D22_20_49.obj',
'D22_20_5.obj',
'D22_20_50.obj',
'D22_20_51.obj',
'D22_20_52.obj',
'D22_20_53.obj',
'D22_20_54.obj',
'D22_20_55.obj',
'D22_20_56.obj',
'D22_20_57.obj',
'D22_20_58.obj',
'D22_20_59.obj',
'D22_20_6.obj',
'D22_20_60.obj',
'D22_20_61.obj',
'D22_20_62.obj',
'D22_20_63.obj',
'D22_20_64.obj',
'D22_20_65.obj',
'D22_20_66.obj',
'D22_20_67.obj',
'D22_20_68.obj',
'D22_20_69.obj',
'D22_20_7.obj',
'D22_20_70.obj',
'D22_20_71.obj',
'D22_20_72.obj',
'D22_20_73.obj',
'D22_20_74.obj',
'D22_20_75.obj',
'D22_20_76.obj',
'D22_20_77.obj',
'D22_20_78.obj',
'D22_20_79.obj',
'D22_20_8.obj',
'D22_20_80.obj',
'D22_20_81.obj',
'D22_20_82.obj',
'D22_20_83.obj',
'D22_20_84.obj',
'D22_20_85.obj',
'D22_20_86.obj',
'D22_20_87.obj',
'D22_20_88.obj',
'D22_20_89.obj',
'D22_20_9.obj',
'D22_20_90.obj',
'D22_20_91.obj',
'D22_20_92.obj',
'D22_20_93.obj',
'D22_20_94.obj',
'D22_20_95.obj',
'D22_20_96.obj',
'D22_20_97.obj',
'D22_20_98.obj',
'D22_20_99.obj',
'D232_35_1.obj',
'D232_35_2.obj',
'D233_35_1.obj',
'D233_35_2.obj',
'D233_35_3.obj',
'D234_d226_8_1.obj',
'D234_d226_8_2.obj',
'D234_d226_8_3.obj',
'D234_d226_8_4.obj',
'D234_d226_8_5.obj',
'D234_d226_8_6.obj',
'D238.4_d230_8_1.obj',
'D238.4_d230_8_2.obj',
'D238.4_d230_8_3.obj',
'D238.4_d230_8_4.obj',
'D240_d226_54.5_1.obj',
'D240_d226_54.5_10.obj',
'D240_d226_54.5_100.obj',
'D240_d226_54.5_101.obj',
'D240_d226_54.5_102.obj',
'D240_d226_54.5_103.obj',
'D240_d226_54.5_104.obj',
'D240_d226_54.5_105.obj',
'D240_d226_54.5_106.obj',
'D240_d226_54.5_107.obj',
'D240_d226_54.5_108.obj',
'D240_d226_54.5_109.obj',
'D240_d226_54.5_11.obj',
'D240_d226_54.5_110.obj',
'D240_d226_54.5_111.obj',
'D240_d226_54.5_112.obj',
'D240_d226_54.5_113.obj',
'D240_d226_54.5_114.obj',
'D240_d226_54.5_115.obj',
'D240_d226_54.5_116.obj',
'D240_d226_54.5_117.obj',
'D240_d226_54.5_118.obj',
'D240_d226_54.5_119.obj',
'D240_d226_54.5_12.obj',
'D240_d226_54.5_120.obj',
'D240_d226_54.5_121.obj',
'D240_d226_54.5_122.obj',
'D240_d226_54.5_123.obj',
'D240_d226_54.5_124.obj',
'D240_d226_54.5_125.obj',
'D240_d226_54.5_126.obj',
'D240_d226_54.5_127.obj',
'D240_d226_54.5_128.obj',
'D240_d226_54.5_129.obj',
'D240_d226_54.5_13.obj',
'D240_d226_54.5_130.obj',
'D240_d226_54.5_131.obj',
'D240_d226_54.5_132.obj',
'D240_d226_54.5_133.obj',
'D240_d226_54.5_134.obj',
'D240_d226_54.5_135.obj',
'D240_d226_54.5_136.obj',
'D240_d226_54.5_137.obj',
'D240_d226_54.5_138.obj',
'D240_d226_54.5_139.obj',
'D240_d226_54.5_14.obj',
'D240_d226_54.5_140.obj',
'D240_d226_54.5_141.obj',
'D240_d226_54.5_142.obj',
'D240_d226_54.5_143.obj',
'D240_d226_54.5_144.obj',
'D240_d226_54.5_145.obj',
'D240_d226_54.5_146.obj',
'D240_d226_54.5_147.obj',
'D240_d226_54.5_148.obj',
'D240_d226_54.5_149.obj',
'D240_d226_54.5_15.obj',
'D240_d226_54.5_150.obj',
'D240_d226_54.5_151.obj',
'D240_d226_54.5_152.obj',
'D240_d226_54.5_153.obj',
'D240_d226_54.5_154.obj',
'D240_d226_54.5_155.obj',
'D240_d226_54.5_156.obj',
'D240_d226_54.5_157.obj',
'D240_d226_54.5_158.obj',
'D240_d226_54.5_159.obj',
'D240_d226_54.5_16.obj',
'D240_d226_54.5_160.obj',
'D240_d226_54.5_161.obj',
'D240_d226_54.5_162.obj',
'D240_d226_54.5_163.obj',
'D240_d226_54.5_164.obj',
'D240_d226_54.5_165.obj',
'D240_d226_54.5_166.obj',
'D240_d226_54.5_167.obj',
'D240_d226_54.5_168.obj',
'D240_d226_54.5_169.obj',
'D240_d226_54.5_17.obj',
'D240_d226_54.5_170.obj',
'D240_d226_54.5_171.obj',
'D240_d226_54.5_172.obj',
'D240_d226_54.5_173.obj',
'D240_d226_54.5_174.obj',
'D240_d226_54.5_175.obj',
'D240_d226_54.5_176.obj',
'D240_d226_54.5_177.obj',
'D240_d226_54.5_178.obj',
'D240_d226_54.5_179.obj',
'D240_d226_54.5_18.obj',
'D240_d226_54.5_180.obj',
'D240_d226_54.5_181.obj',
'D240_d226_54.5_182.obj',
'D240_d226_54.5_183.obj',
'D240_d226_54.5_184.obj',
'D240_d226_54.5_185.obj',
'D240_d226_54.5_186.obj',
'D240_d226_54.5_187.obj',
'D240_d226_54.5_188.obj',
'D240_d226_54.5_189.obj',
'D240_d226_54.5_19.obj',
'D240_d226_54.5_190.obj',
'D240_d226_54.5_191.obj',
'D240_d226_54.5_192.obj',
'D240_d226_54.5_193.obj',
'D240_d226_54.5_194.obj',
'D240_d226_54.5_195.obj',
'D240_d226_54.5_196.obj',
'D240_d226_54.5_197.obj',
'D240_d226_54.5_198.obj',
'D240_d226_54.5_199.obj',
'D240_d226_54.5_2.obj',
'D240_d226_54.5_20.obj',
'D240_d226_54.5_200.obj',
'D240_d226_54.5_201.obj',
'D240_d226_54.5_202.obj',
'D240_d226_54.5_203.obj',
'D240_d226_54.5_204.obj',
'D240_d226_54.5_205.obj',
'D240_d226_54.5_206.obj',
'D240_d226_54.5_207.obj',
'D240_d226_54.5_208.obj',
'D240_d226_54.5_209.obj',
'D240_d226_54.5_21.obj',
'D240_d226_54.5_210.obj',
'D240_d226_54.5_211.obj',
'D240_d226_54.5_212.obj',
'D240_d226_54.5_213.obj',
'D240_d226_54.5_214.obj',
'D240_d226_54.5_215.obj',
'D240_d226_54.5_216.obj',
'D240_d226_54.5_217.obj',
'D240_d226_54.5_218.obj',
'D240_d226_54.5_219.obj',
'D240_d226_54.5_22.obj',
'D240_d226_54.5_220.obj',
'D240_d226_54.5_221.obj',
'D240_d226_54.5_222.obj',
'D240_d226_54.5_223.obj',
'D240_d226_54.5_224.obj',
'D240_d226_54.5_225.obj',
'D240_d226_54.5_226.obj',
'D240_d226_54.5_227.obj',
'D240_d226_54.5_228.obj',
'D240_d226_54.5_229.obj',
'D240_d226_54.5_23.obj',
'D240_d226_54.5_230.obj',
'D240_d226_54.5_231.obj',
'D240_d226_54.5_232.obj',
'D240_d226_54.5_233.obj',
'D240_d226_54.5_234.obj',
'D240_d226_54.5_235.obj',
'D240_d226_54.5_236.obj',
'D240_d226_54.5_237.obj',
'D240_d226_54.5_238.obj',
'D240_d226_54.5_239.obj',
'D240_d226_54.5_24.obj',
'D240_d226_54.5_240.obj',
'D240_d226_54.5_241.obj',
'D240_d226_54.5_242.obj',
'D240_d226_54.5_243.obj',
'D240_d226_54.5_244.obj',
'D240_d226_54.5_245.obj',
'D240_d226_54.5_246.obj',
'D240_d226_54.5_247.obj',
'D240_d226_54.5_248.obj',
'D240_d226_54.5_249.obj',
'D240_d226_54.5_25.obj',
'D240_d226_54.5_250.obj',
'D240_d226_54.5_251.obj',
'D240_d226_54.5_252.obj',
'D240_d226_54.5_253.obj',
'D240_d226_54.5_254.obj',
'D240_d226_54.5_255.obj',
'D240_d226_54.5_256.obj',
'D240_d226_54.5_257.obj',
'D240_d226_54.5_258.obj',
'D240_d226_54.5_259.obj',
'D240_d226_54.5_26.obj',
'D240_d226_54.5_260.obj',
'D240_d226_54.5_261.obj',
'D240_d226_54.5_262.obj',
'D240_d226_54.5_263.obj',
'D240_d226_54.5_264.obj',
'D240_d226_54.5_265.obj',
'D240_d226_54.5_266.obj',
'D240_d226_54.5_267.obj',
'D240_d226_54.5_268.obj',
'D240_d226_54.5_269.obj',
'D240_d226_54.5_27.obj',
'D240_d226_54.5_270.obj',
'D240_d226_54.5_271.obj',
'D240_d226_54.5_272.obj',
'D240_d226_54.5_273.obj',
'D240_d226_54.5_274.obj',
'D240_d226_54.5_275.obj',
'D240_d226_54.5_276.obj',
'D240_d226_54.5_277.obj',
'D240_d226_54.5_278.obj',
'D240_d226_54.5_279.obj',
'D240_d226_54.5_28.obj',
'D240_d226_54.5_280.obj',
'D240_d226_54.5_281.obj',
'D240_d226_54.5_282.obj',
'D240_d226_54.5_283.obj',
'D240_d226_54.5_284.obj',
'D240_d226_54.5_285.obj',
'D240_d226_54.5_286.obj',
'D240_d226_54.5_287.obj',
'D240_d226_54.5_288.obj',
'D240_d226_54.5_289.obj',
'D240_d226_54.5_29.obj',
'D240_d226_54.5_290.obj',
'D240_d226_54.5_291.obj',
'D240_d226_54.5_292.obj',
'D240_d226_54.5_293.obj',
'D240_d226_54.5_294.obj',
'D240_d226_54.5_295.obj',
'D240_d226_54.5_296.obj',
'D240_d226_54.5_297.obj',
'D240_d226_54.5_298.obj',
'D240_d226_54.5_299.obj',
'D240_d226_54.5_3.obj',
'D240_d226_54.5_30.obj',
'D240_d226_54.5_300.obj',
'D240_d226_54.5_301.obj',
'D240_d226_54.5_302.obj',
'D240_d226_54.5_303.obj',
'D240_d226_54.5_304.obj',
'D240_d226_54.5_305.obj',
'D240_d226_54.5_306.obj',
'D240_d226_54.5_307.obj',
'D240_d226_54.5_308.obj',
'D240_d226_54.5_309.obj',
'D240_d226_54.5_31.obj',
'D240_d226_54.5_310.obj',
'D240_d226_54.5_311.obj',
'D240_d226_54.5_312.obj',
'D240_d226_54.5_313.obj',
'D240_d226_54.5_314.obj',
'D240_d226_54.5_315.obj',
'D240_d226_54.5_316.obj',
'D240_d226_54.5_317.obj',
'D240_d226_54.5_318.obj',
'D240_d226_54.5_319.obj',
'D240_d226_54.5_32.obj',
'D240_d226_54.5_320.obj',
'D240_d226_54.5_321.obj',
'D240_d226_54.5_322.obj',
'D240_d226_54.5_323.obj',
'D240_d226_54.5_324.obj',
'D240_d226_54.5_325.obj',
'D240_d226_54.5_326.obj',
'D240_d226_54.5_327.obj',
'D240_d226_54.5_328.obj',
'D240_d226_54.5_329.obj',
'D240_d226_54.5_33.obj',
'D240_d226_54.5_330.obj',
'D240_d226_54.5_331.obj',
'D240_d226_54.5_332.obj',
'D240_d226_54.5_333.obj',
'D240_d226_54.5_334.obj',
'D240_d226_54.5_335.obj',
'D240_d226_54.5_336.obj',
'D240_d226_54.5_337.obj',
'D240_d226_54.5_338.obj',
'D240_d226_54.5_339.obj',
'D240_d226_54.5_34.obj',
'D240_d226_54.5_35.obj',
'D240_d226_54.5_36.obj',
'D240_d226_54.5_37.obj',
'D240_d226_54.5_38.obj',
'D240_d226_54.5_39.obj',
'D240_d226_54.5_4.obj',
'D240_d226_54.5_40.obj',
'D240_d226_54.5_41.obj',
'D240_d226_54.5_42.obj',
'D240_d226_54.5_43.obj',
'D240_d226_54.5_44.obj',
'D240_d226_54.5_45.obj',
'D240_d226_54.5_46.obj',
'D240_d226_54.5_47.obj',
'D240_d226_54.5_48.obj',
'D240_d226_54.5_49.obj',
'D240_d226_54.5_5.obj',
'D240_d226_54.5_50.obj',
'D240_d226_54.5_51.obj',
'D240_d226_54.5_52.obj',
'D240_d226_54.5_53.obj',
'D240_d226_54.5_54.obj',
'D240_d226_54.5_55.obj',
'D240_d226_54.5_56.obj',
'D240_d226_54.5_57.obj',
'D240_d226_54.5_58.obj',
'D240_d226_54.5_59.obj',
'D240_d226_54.5_6.obj',
'D240_d226_54.5_60.obj',
'D240_d226_54.5_61.obj',
'D240_d226_54.5_62.obj',
'D240_d226_54.5_63.obj',
'D240_d226_54.5_64.obj',
'D240_d226_54.5_65.obj',
'D240_d226_54.5_66.obj',
'D240_d226_54.5_67.obj',
'D240_d226_54.5_68.obj',
'D240_d226_54.5_69.obj',
'D240_d226_54.5_7.obj',
'D240_d226_54.5_70.obj',
'D240_d226_54.5_71.obj',
'D240_d226_54.5_72.obj',
'D240_d226_54.5_73.obj',
'D240_d226_54.5_74.obj',
'D240_d226_54.5_75.obj',
'D240_d226_54.5_76.obj',
'D240_d226_54.5_77.obj',
'D240_d226_54.5_78.obj',
'D240_d226_54.5_79.obj',
'D240_d226_54.5_8.obj',
'D240_d226_54.5_80.obj',
'D240_d226_54.5_81.obj',
'D240_d226_54.5_82.obj',
'D240_d226_54.5_83.obj',
'D240_d226_54.5_84.obj',
'D240_d226_54.5_85.obj',
'D240_d226_54.5_86.obj',
'D240_d226_54.5_87.obj',
'D240_d226_54.5_88.obj',
'D240_d226_54.5_89.obj',
'D240_d226_54.5_9.obj',
'D240_d226_54.5_90.obj',
'D240_d226_54.5_91.obj',
'D240_d226_54.5_92.obj',
'D240_d226_54.5_93.obj',
'D240_d226_54.5_94.obj',
'D240_d226_54.5_95.obj',
'D240_d226_54.5_96.obj',
'D240_d226_54.5_97.obj',
'D240_d226_54.5_98.obj',
'D240_d226_54.5_99.obj',
'D241_d205.2_8_1.obj',
'D241_d205.2_8_10.obj',
'D241_d205.2_8_11.obj',
'D241_d205.2_8_12.obj',
'D241_d205.2_8_13.obj',
'D241_d205.2_8_14.obj',
'D241_d205.2_8_15.obj',
'D241_d205.2_8_16.obj',
'D241_d205.2_8_17.obj',
'D241_d205.2_8_18.obj',
'D241_d205.2_8_19.obj',
'D241_d205.2_8_2.obj',
'D241_d205.2_8_20.obj',
'D241_d205.2_8_3.obj',
'D241_d205.2_8_4.obj',
'D241_d205.2_8_5.obj',
'D241_d205.2_8_6.obj',
'D241_d205.2_8_7.obj',
'D241_d205.2_8_8.obj',
'D241_d205.2_8_9.obj',
'D241_d205_8_1.obj',
'D241_d205_8_2.obj',
'D241_d205_8_3.obj',
'D241_d205_8_4.obj',
'D241_d205_8_5.obj',
'D241_d205_8_6.obj',
'D241_d228_42_1.obj',
'D241_d228_42_2.obj',
'D241_d228_42_3.obj',
'D241_d228_42_4.obj',
'D241_d228_42_5.obj',
'D242_d199_15_1.obj',
'D242_d199_15_10.obj',
'D242_d199_15_11.obj',
'D242_d199_15_12.obj',
'D242_d199_15_13.obj',
'D242_d199_15_14.obj',
'D242_d199_15_15.obj',
'D242_d199_15_16.obj',
'D242_d199_15_17.obj',
'D242_d199_15_18.obj',
'D242_d199_15_19.obj',
'D242_d199_15_2.obj',
'D242_d199_15_20.obj',
'D242_d199_15_3.obj',
'D242_d199_15_4.obj',
'D242_d199_15_5.obj',
'D242_d199_15_6.obj',
'D242_d199_15_7.obj',
'D242_d199_15_8.obj',
'D242_d199_15_9.obj',
'D242_d201_15_1.obj',
'D242_d201_15_10.obj',
'D242_d201_15_11.obj',
'D242_d201_15_12.obj',
'D242_d201_15_13.obj',
'D242_d201_15_14.obj',
'D242_d201_15_2.obj',
'D242_d201_15_3.obj',
'D242_d201_15_4.obj',
'D242_d201_15_5.obj',
'D242_d201_15_6.obj',
'D242_d201_15_7.obj',
'D242_d201_15_8.obj',
'D242_d201_15_9.obj',
'D242_d223_43_1.obj',
'D242_d223_43_2.obj',
'D242_d223_43_3.obj',
'D246_d210.2_8_1.obj',
'D246_d210.2_8_2.obj',
'D246_d210.2_8_3.obj',
'D246_d210.2_8_4.obj',
'D246_d210.2_8_5.obj',
'D246_d210.2_8_6.obj',
'D250_2_1.obj',
'D250_2_2.obj',
'D250_2_3.obj',
'D250_2_4.obj',
'D250_d240_20_1.obj',
'D250_d240_20_2.obj',
'D250_d240_20_3.obj',
'D250_d240_20_4.obj',
'D250_d240_20_5.obj',
'D250_d240_20_6.obj',
'D25_21_1.obj',
'D25_21_10.obj',
'D25_21_100.obj',
'D25_21_101.obj',
'D25_21_102.obj',
'D25_21_103.obj',
'D25_21_104.obj',
'D25_21_105.obj',
'D25_21_106.obj',
'D25_21_107.obj',
'D25_21_108.obj',
'D25_21_109.obj',
'D25_21_11.obj',
'D25_21_110.obj',
'D25_21_111.obj',
'D25_21_112.obj',
'D25_21_113.obj',
'D25_21_114.obj',
'D25_21_115.obj',
'D25_21_116.obj',
'D25_21_117.obj',
'D25_21_118.obj',
'D25_21_119.obj',
'D25_21_12.obj',
'D25_21_120.obj',
'D25_21_121.obj',
'D25_21_122.obj',
'D25_21_123.obj',
'D25_21_124.obj',
'D25_21_125.obj',
'D25_21_126.obj',
'D25_21_127.obj',
'D25_21_128.obj',
'D25_21_129.obj',
'D25_21_13.obj',
'D25_21_130.obj',
'D25_21_131.obj',
'D25_21_132.obj',
'D25_21_133.obj',
'D25_21_134.obj',
'D25_21_135.obj',
'D25_21_136.obj',
'D25_21_137.obj',
'D25_21_138.obj',
'D25_21_139.obj',
'D25_21_14.obj',
'D25_21_140.obj',
'D25_21_141.obj',
'D25_21_142.obj',
'D25_21_143.obj',
'D25_21_144.obj',
'D25_21_145.obj',
'D25_21_146.obj',
'D25_21_147.obj',
'D25_21_148.obj',
'D25_21_149.obj',
'D25_21_15.obj',
'D25_21_150.obj',
'D25_21_151.obj',
'D25_21_152.obj',
'D25_21_153.obj',
'D25_21_154.obj',
'D25_21_155.obj',
'D25_21_156.obj',
'D25_21_157.obj',
'D25_21_158.obj',
'D25_21_159.obj',
'D25_21_16.obj',
'D25_21_160.obj',
'D25_21_161.obj',
'D25_21_162.obj',
'D25_21_163.obj',
'D25_21_164.obj',
'D25_21_165.obj',
'D25_21_166.obj',
'D25_21_167.obj',
'D25_21_168.obj',
'D25_21_169.obj',
'D25_21_17.obj',
'D25_21_170.obj',
'D25_21_171.obj',
'D25_21_172.obj',
'D25_21_173.obj',
'D25_21_174.obj',
'D25_21_175.obj',
'D25_21_176.obj',
'D25_21_177.obj',
'D25_21_178.obj',
'D25_21_179.obj',
'D25_21_18.obj',
'D25_21_180.obj',
'D25_21_181.obj',
'D25_21_182.obj',
'D25_21_183.obj',
'D25_21_184.obj',
'D25_21_185.obj',
'D25_21_186.obj',
'D25_21_187.obj',
'D25_21_188.obj',
'D25_21_189.obj',
'D25_21_19.obj',
'D25_21_190.obj',
'D25_21_191.obj',
'D25_21_192.obj',
'D25_21_193.obj',
'D25_21_194.obj',
'D25_21_195.obj',
'D25_21_196.obj',
'D25_21_197.obj',
'D25_21_198.obj',
'D25_21_199.obj',
'D25_21_2.obj',
'D25_21_20.obj',
'D25_21_200.obj',
'D25_21_21.obj',
'D25_21_22.obj',
'D25_21_23.obj',
'D25_21_24.obj',
'D25_21_25.obj',
'D25_21_26.obj',
'D25_21_27.obj',
'D25_21_28.obj',
'D25_21_29.obj',
'D25_21_3.obj',
'D25_21_30.obj',
'D25_21_31.obj',
'D25_21_32.obj',
'D25_21_33.obj',
'D25_21_34.obj',
'D25_21_35.obj',
'D25_21_36.obj',
'D25_21_37.obj',
'D25_21_38.obj',
'D25_21_39.obj',
'D25_21_4.obj',
'D25_21_40.obj',
'D25_21_41.obj',
'D25_21_42.obj',
'D25_21_43.obj',
'D25_21_44.obj',
'D25_21_45.obj',
'D25_21_46.obj',
'D25_21_47.obj',
'D25_21_48.obj',
'D25_21_49.obj',
'D25_21_5.obj',
'D25_21_50.obj',
'D25_21_51.obj',
'D25_21_52.obj',
'D25_21_53.obj',
'D25_21_54.obj',
'D25_21_55.obj',
'D25_21_56.obj',
'D25_21_57.obj',
'D25_21_58.obj',
'D25_21_59.obj',
'D25_21_6.obj',
'D25_21_60.obj',
'D25_21_61.obj',
'D25_21_62.obj',
'D25_21_63.obj',
'D25_21_64.obj',
'D25_21_65.obj',
'D25_21_66.obj',
'D25_21_67.obj',
'D25_21_68.obj',
'D25_21_69.obj',
'D25_21_7.obj',
'D25_21_70.obj',
'D25_21_71.obj',
'D25_21_72.obj',
'D25_21_73.obj',
'D25_21_74.obj',
'D25_21_75.obj',
'D25_21_76.obj',
'D25_21_77.obj',
'D25_21_78.obj',
'D25_21_79.obj',
'D25_21_8.obj',
'D25_21_80.obj',
'D25_21_81.obj',
'D25_21_82.obj',
'D25_21_83.obj',
'D25_21_84.obj',
'D25_21_85.obj',
'D25_21_86.obj',
'D25_21_87.obj',
'D25_21_88.obj',
'D25_21_89.obj',
'D25_21_9.obj',
'D25_21_90.obj',
'D25_21_91.obj',
'D25_21_92.obj',
'D25_21_93.obj',
'D25_21_94.obj',
'D25_21_95.obj',
'D25_21_96.obj',
'D25_21_97.obj',
'D25_21_98.obj',
'D25_21_99.obj',
'D261_d255.2_8_1.obj',
'D261_d255.2_8_2.obj',
'D261_d255.2_8_3.obj',
'D270_d240_124_1.obj',
'D270_d240_124_2.obj',
'D28_6_1.obj',
'D28_6_10.obj',
'D28_6_100.obj',
'D28_6_101.obj',
'D28_6_102.obj',
'D28_6_103.obj',
'D28_6_104.obj',
'D28_6_105.obj',
'D28_6_106.obj',
'D28_6_107.obj',
'D28_6_108.obj',
'D28_6_109.obj',
'D28_6_11.obj',
'D28_6_110.obj',
'D28_6_111.obj',
'D28_6_112.obj',
'D28_6_113.obj',
'D28_6_114.obj',
'D28_6_115.obj',
'D28_6_116.obj',
'D28_6_117.obj',
'D28_6_118.obj',
'D28_6_119.obj',
'D28_6_12.obj',
'D28_6_120.obj',
'D28_6_121.obj',
'D28_6_122.obj',
'D28_6_123.obj',
'D28_6_124.obj',
'D28_6_125.obj',
'D28_6_126.obj',
'D28_6_127.obj',
'D28_6_128.obj',
'D28_6_129.obj',
'D28_6_13.obj',
'D28_6_130.obj',
'D28_6_131.obj',
'D28_6_132.obj',
'D28_6_133.obj',
'D28_6_134.obj',
'D28_6_135.obj',
'D28_6_136.obj',
'D28_6_137.obj',
'D28_6_138.obj',
'D28_6_139.obj',
'D28_6_14.obj',
'D28_6_140.obj',
'D28_6_141.obj',
'D28_6_142.obj',
'D28_6_143.obj',
'D28_6_144.obj',
'D28_6_145.obj',
'D28_6_146.obj',
'D28_6_147.obj',
'D28_6_148.obj',
'D28_6_149.obj',
'D28_6_15.obj',
'D28_6_150.obj',
'D28_6_151.obj',
'D28_6_152.obj',
'D28_6_153.obj',
'D28_6_154.obj',
'D28_6_155.obj',
'D28_6_156.obj',
'D28_6_157.obj',
'D28_6_158.obj',
'D28_6_159.obj',
'D28_6_16.obj',
'D28_6_160.obj',
'D28_6_161.obj',
'D28_6_162.obj',
'D28_6_163.obj',
'D28_6_164.obj',
'D28_6_165.obj',
'D28_6_166.obj',
'D28_6_167.obj',
'D28_6_168.obj',
'D28_6_169.obj',
'D28_6_17.obj',
'D28_6_170.obj',
'D28_6_171.obj',
'D28_6_172.obj',
'D28_6_173.obj',
'D28_6_174.obj',
'D28_6_175.obj',
'D28_6_176.obj',
'D28_6_177.obj',
'D28_6_178.obj',
'D28_6_179.obj',
'D28_6_18.obj',
'D28_6_180.obj',
'D28_6_181.obj',
'D28_6_182.obj',
'D28_6_183.obj',
'D28_6_184.obj',
'D28_6_185.obj',
'D28_6_186.obj',
'D28_6_187.obj',
'D28_6_188.obj',
'D28_6_189.obj',
'D28_6_19.obj',
'D28_6_190.obj',
'D28_6_191.obj',
'D28_6_192.obj',
'D28_6_193.obj',
'D28_6_194.obj',
'D28_6_195.obj',
'D28_6_196.obj',
'D28_6_197.obj',
'D28_6_198.obj',
'D28_6_199.obj',
'D28_6_2.obj',
'D28_6_20.obj',
'D28_6_200.obj',
'D28_6_21.obj',
'D28_6_22.obj',
'D28_6_23.obj',
'D28_6_24.obj',
'D28_6_25.obj',
'D28_6_26.obj',
'D28_6_27.obj',
'D28_6_28.obj',
'D28_6_29.obj',
'D28_6_3.obj',
'D28_6_30.obj',
'D28_6_31.obj',
'D28_6_32.obj',
'D28_6_33.obj',
'D28_6_34.obj',
'D28_6_35.obj',
'D28_6_36.obj',
'D28_6_37.obj',
'D28_6_38.obj',
'D28_6_39.obj',
'D28_6_4.obj',
'D28_6_40.obj',
'D28_6_41.obj',
'D28_6_42.obj',
'D28_6_43.obj',
'D28_6_44.obj',
'D28_6_45.obj',
'D28_6_46.obj',
'D28_6_47.obj',
'D28_6_48.obj',
'D28_6_49.obj',
'D28_6_5.obj',
'D28_6_50.obj',
'D28_6_51.obj',
'D28_6_52.obj',
'D28_6_53.obj',
'D28_6_54.obj',
'D28_6_55.obj',
'D28_6_56.obj',
'D28_6_57.obj',
'D28_6_58.obj',
'D28_6_59.obj',
'D28_6_6.obj',
'D28_6_60.obj',
'D28_6_61.obj',
'D28_6_62.obj',
'D28_6_63.obj',
'D28_6_64.obj',
'D28_6_65.obj',
'D28_6_66.obj',
'D28_6_67.obj',
'D28_6_68.obj',
'D28_6_69.obj',
'D28_6_7.obj',
'D28_6_70.obj',
'D28_6_71.obj',
'D28_6_72.obj',
'D28_6_73.obj',
'D28_6_74.obj',
'D28_6_75.obj',
'D28_6_76.obj',
'D28_6_77.obj',
'D28_6_78.obj',
'D28_6_79.obj',
'D28_6_8.obj',
'D28_6_80.obj',
'D28_6_81.obj',
'D28_6_82.obj',
'D28_6_83.obj',
'D28_6_84.obj',
'D28_6_85.obj',
'D28_6_86.obj',
'D28_6_87.obj',
'D28_6_88.obj',
'D28_6_89.obj',
'D28_6_9.obj',
'D28_6_90.obj',
'D28_6_91.obj',
'D28_6_92.obj',
'D28_6_93.obj',
'D28_6_94.obj',
'D28_6_95.obj',
'D28_6_96.obj',
'D28_6_97.obj',
'D28_6_98.obj',
'D28_6_99.obj',
'D291.8_d278_44.7_1.obj',
'D291.8_d278_44.7_2.obj',
'D291.8_d278_44.7_3.obj',
'D291.8_d278_44.7_4.obj',
'D291.8_d278_44.7_5.obj',
'D291.8_d278_44.7_6.obj',
'D292_d190_6_1.obj',
'D292_d190_6_2.obj',
'D292_d190_6_3.obj',
'D292_d190_6_4.obj',
'D292_d190_6_5.obj',
'D292_d190_6_6.obj',
'D292_d190_6_7.obj',
'D292_d190_6_8.obj',
'D300_207_1.obj',
'D300_d235_8_1.obj',
'D300_d235_8_10.obj',
'D300_d235_8_2.obj',
'D300_d235_8_3.obj',
'D300_d235_8_4.obj',
'D300_d235_8_5.obj',
'D300_d235_8_6.obj',
'D300_d235_8_7.obj',
'D300_d235_8_8.obj',
'D300_d235_8_9.obj',
'D300_d236_15_1.obj',
'D300_d236_15_2.obj',
'D300_d236_15_3.obj',
'D300_d236_15_4.obj',
'D300_d236_15_5.obj',
'D300_d236_15_6.obj',
'D300_d276_20_1.obj',
'D300_d276_20_2.obj',
'D300_d276_20_3.obj',
'D300_d276_20_4.obj',
'D300_d276_20_5.obj',
'D300_d276_20_6.obj',
'D300_d290_31_1.obj',
'D300_d290_31_10.obj',
'D300_d290_31_2.obj',
'D300_d290_31_3.obj',
'D300_d290_31_4.obj',
'D300_d290_31_5.obj',
'D300_d290_31_6.obj',
'D300_d290_31_7.obj',
'D300_d290_31_8.obj',
'D300_d290_31_9.obj',
'D300_d290_46_1.obj',
'D300_d290_46_2.obj',
'D300_d290_46_3.obj',
'D300_d290_46_4.obj',
'D300_d290_46_5.obj',
'D300_d290_46_6.obj',
'D306_18_1.obj',
'D306_18_2.obj',
'D306_18_3.obj',
'D306_18_4.obj',
'D310_2_1.obj',
'D310_2_2.obj',
'D317_d305_4.2_1.obj',
'D317_d305_4.2_10.obj',
'D317_d305_4.2_2.obj',
'D317_d305_4.2_3.obj',
'D317_d305_4.2_4.obj',
'D317_d305_4.2_5.obj',
'D317_d305_4.2_6.obj',
'D317_d305_4.2_7.obj',
'D317_d305_4.2_8.obj',
'D317_d305_4.2_9.obj',
'D320.85_d300_31_1.obj',
'D320.85_d300_31_2.obj',
'D320.85_d300_31_3.obj',
'D320.8_d230.2_4_1.obj',
'D320.8_d230.2_4_2.obj',
'D320.8_d230.2_4_3.obj',
'D320.8_d230.2_4_4.obj',
'D320.8_d230.2_4_5.obj',
'D320.8_d230.2_4_6.obj',
'D326.8_d298_58_1.obj',
'D326.8_d298_58_2.obj',
'D326.8_d298_58_3.obj',
'D326.8_d298_58_4.obj',
'D340_30_1.obj',
'D340_30_2.obj',
'D340_75_1.obj',
'D340_75_2.obj',
'D340_d284_258_1.obj',
'D340_d284_258_2.obj',
'D352_d255_10_1.obj',
'D52_d20_145_1.obj',
'D52_d25_155(1)_1.obj',
'D52_d25_155(1)_2.obj',
'D52_d25_155_1.obj',
'D52_d25_155_2.obj',
'M184_13_1.obj',
'M184_13_10.obj',
'M184_13_11.obj',
'M184_13_12.obj',
'M184_13_13.obj',
'M184_13_14.obj',
'M184_13_15.obj',
'M184_13_16.obj',
'M184_13_17.obj',
'M184_13_18.obj',
'M184_13_19.obj',
'M184_13_2.obj',
'M184_13_20.obj',
'M184_13_3.obj',
'M184_13_4.obj',
'M184_13_5.obj',
'M184_13_6.obj',
'M184_13_7.obj',
'M184_13_8.obj',
'M184_13_9.obj'
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
// 全局变量定义（新增 sceneContainer 和物料列表相关变量）
let scene, camera, renderer, raycaster, mouse, orbitControls;
let transparentBox, allModels = [];
const OBJECT_DIR = './Objects3/';
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
    const heightMarks = [1400, 1000, 600];
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
        const yPos = markValue - height/2; // 1400 → 1400-950=450；1000→50；600→-350
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
'25_25_10_2.obj',
'25_25_10_3.obj',
'25_25_10_4.obj',
'50_50_30_1.obj',
'50_50_30_2.obj',
'50_50_30_3.obj',
'50_50_30_4.obj',
'D142_d136_152_1.obj',
'D142_d136_152_10.obj',
'D142_d136_152_100.obj',
'D142_d136_152_101.obj',
'D142_d136_152_102.obj',
'D142_d136_152_103.obj',
'D142_d136_152_104.obj',
'D142_d136_152_105.obj',
'D142_d136_152_106.obj',
'D142_d136_152_107.obj',
'D142_d136_152_108.obj',
'D142_d136_152_109.obj',
'D142_d136_152_11.obj',
'D142_d136_152_110.obj',
'D142_d136_152_111.obj',
'D142_d136_152_112.obj',
'D142_d136_152_113.obj',
'D142_d136_152_114.obj',
'D142_d136_152_115.obj',
'D142_d136_152_116.obj',
'D142_d136_152_117.obj',
'D142_d136_152_118.obj',
'D142_d136_152_119.obj',
'D142_d136_152_12.obj',
'D142_d136_152_120.obj',
'D142_d136_152_121.obj',
'D142_d136_152_122.obj',
'D142_d136_152_123.obj',
'D142_d136_152_124.obj',
'D142_d136_152_125.obj',
'D142_d136_152_126.obj',
'D142_d136_152_127.obj',
'D142_d136_152_128.obj',
'D142_d136_152_129.obj',
'D142_d136_152_13.obj',
'D142_d136_152_130.obj',
'D142_d136_152_131.obj',
'D142_d136_152_132.obj',
'D142_d136_152_133.obj',
'D142_d136_152_134.obj',
'D142_d136_152_135.obj',
'D142_d136_152_136.obj',
'D142_d136_152_137.obj',
'D142_d136_152_138.obj',
'D142_d136_152_139.obj',
'D142_d136_152_14.obj',
'D142_d136_152_140.obj',
'D142_d136_152_141.obj',
'D142_d136_152_142.obj',
'D142_d136_152_143.obj',
'D142_d136_152_144.obj',
'D142_d136_152_145.obj',
'D142_d136_152_146.obj',
'D142_d136_152_147.obj',
'D142_d136_152_148.obj',
'D142_d136_152_149.obj',
'D142_d136_152_15.obj',
'D142_d136_152_150.obj',
'D142_d136_152_151.obj',
'D142_d136_152_152.obj',
'D142_d136_152_153.obj',
'D142_d136_152_154.obj',
'D142_d136_152_155.obj',
'D142_d136_152_156.obj',
'D142_d136_152_157.obj',
'D142_d136_152_158.obj',
'D142_d136_152_159.obj',
'D142_d136_152_16.obj',
'D142_d136_152_160.obj',
'D142_d136_152_161.obj',
'D142_d136_152_162.obj',
'D142_d136_152_163.obj',
'D142_d136_152_164.obj',
'D142_d136_152_165.obj',
'D142_d136_152_166.obj',
'D142_d136_152_167.obj',
'D142_d136_152_168.obj',
'D142_d136_152_169.obj',
'D142_d136_152_17.obj',
'D142_d136_152_170.obj',
'D142_d136_152_171.obj',
'D142_d136_152_172.obj',
'D142_d136_152_173.obj',
'D142_d136_152_174.obj',
'D142_d136_152_175.obj',
'D142_d136_152_176.obj',
'D142_d136_152_177.obj',
'D142_d136_152_178.obj',
'D142_d136_152_179.obj',
'D142_d136_152_18.obj',
'D142_d136_152_180.obj',
'D142_d136_152_181.obj',
'D142_d136_152_182.obj',
'D142_d136_152_183.obj',
'D142_d136_152_184.obj',
'D142_d136_152_185.obj',
'D142_d136_152_186.obj',
'D142_d136_152_187.obj',
'D142_d136_152_188.obj',
'D142_d136_152_189.obj',
'D142_d136_152_19.obj',
'D142_d136_152_190.obj',
'D142_d136_152_191.obj',
'D142_d136_152_192.obj',
'D142_d136_152_193.obj',
'D142_d136_152_194.obj',
'D142_d136_152_195.obj',
'D142_d136_152_196.obj',
'D142_d136_152_197.obj',
'D142_d136_152_198.obj',
'D142_d136_152_199.obj',
'D142_d136_152_2.obj',
'D142_d136_152_20.obj',
'D142_d136_152_200.obj',
'D142_d136_152_21.obj',
'D142_d136_152_22.obj',
'D142_d136_152_23.obj',
'D142_d136_152_24.obj',
'D142_d136_152_25.obj',
'D142_d136_152_26.obj',
'D142_d136_152_27.obj',
'D142_d136_152_28.obj',
'D142_d136_152_29.obj',
'D142_d136_152_3.obj',
'D142_d136_152_30.obj',
'D142_d136_152_31.obj',
'D142_d136_152_32.obj',
'D142_d136_152_33.obj',
'D142_d136_152_34.obj',
'D142_d136_152_35.obj',
'D142_d136_152_36.obj',
'D142_d136_152_37.obj',
'D142_d136_152_38.obj',
'D142_d136_152_39.obj',
'D142_d136_152_4.obj',
'D142_d136_152_40.obj',
'D142_d136_152_41.obj',
'D142_d136_152_42.obj',
'D142_d136_152_43.obj',
'D142_d136_152_44.obj',
'D142_d136_152_45.obj',
'D142_d136_152_46.obj',
'D142_d136_152_47.obj',
'D142_d136_152_48.obj',
'D142_d136_152_49.obj',
'D142_d136_152_5.obj',
'D142_d136_152_50.obj',
'D142_d136_152_51.obj',
'D142_d136_152_52.obj',
'D142_d136_152_53.obj',
'D142_d136_152_54.obj',
'D142_d136_152_55.obj',
'D142_d136_152_56.obj',
'D142_d136_152_57.obj',
'D142_d136_152_58.obj',
'D142_d136_152_59.obj',
'D142_d136_152_6.obj',
'D142_d136_152_60.obj',
'D142_d136_152_61.obj',
'D142_d136_152_62.obj',
'D142_d136_152_63.obj',
'D142_d136_152_64.obj',
'D142_d136_152_65.obj',
'D142_d136_152_66.obj',
'D142_d136_152_67.obj',
'D142_d136_152_68.obj',
'D142_d136_152_69.obj',
'D142_d136_152_7.obj',
'D142_d136_152_70.obj',
'D142_d136_152_71.obj',
'D142_d136_152_72.obj',
'D142_d136_152_73.obj',
'D142_d136_152_74.obj',
'D142_d136_152_75.obj',
'D142_d136_152_76.obj',
'D142_d136_152_77.obj',
'D142_d136_152_78.obj',
'D142_d136_152_79.obj',
'D142_d136_152_8.obj',
'D142_d136_152_80.obj',
'D142_d136_152_81.obj',
'D142_d136_152_82.obj',
'D142_d136_152_83.obj',
'D142_d136_152_84.obj',
'D142_d136_152_85.obj',
'D142_d136_152_86.obj',
'D142_d136_152_87.obj',
'D142_d136_152_88.obj',
'D142_d136_152_89.obj',
'D142_d136_152_9.obj',
'D142_d136_152_90.obj',
'D142_d136_152_91.obj',
'D142_d136_152_92.obj',
'D142_d136_152_93.obj',
'D142_d136_152_94.obj',
'D142_d136_152_95.obj',
'D142_d136_152_96.obj',
'D142_d136_152_97.obj',
'D142_d136_152_98.obj',
'D142_d136_152_99.obj',
'D199.9_7_1.obj',
'D199.9_7_10.obj',
'D199.9_7_100.obj',
'D199.9_7_101.obj',
'D199.9_7_102.obj',
'D199.9_7_103.obj',
'D199.9_7_104.obj',
'D199.9_7_105.obj',
'D199.9_7_106.obj',
'D199.9_7_107.obj',
'D199.9_7_108.obj',
'D199.9_7_109.obj',
'D199.9_7_11.obj',
'D199.9_7_110.obj',
'D199.9_7_111.obj',
'D199.9_7_112.obj',
'D199.9_7_113.obj',
'D199.9_7_114.obj',
'D199.9_7_115.obj',
'D199.9_7_116.obj',
'D199.9_7_117.obj',
'D199.9_7_118.obj',
'D199.9_7_119.obj',
'D199.9_7_12.obj',
'D199.9_7_120.obj',
'D199.9_7_121.obj',
'D199.9_7_122.obj',
'D199.9_7_123.obj',
'D199.9_7_124.obj',
'D199.9_7_125.obj',
'D199.9_7_126.obj',
'D199.9_7_127.obj',
'D199.9_7_128.obj',
'D199.9_7_129.obj',
'D199.9_7_13.obj',
'D199.9_7_130.obj',
'D199.9_7_131.obj',
'D199.9_7_132.obj',
'D199.9_7_133.obj',
'D199.9_7_134.obj',
'D199.9_7_135.obj',
'D199.9_7_136.obj',
'D199.9_7_137.obj',
'D199.9_7_138.obj',
'D199.9_7_139.obj',
'D199.9_7_14.obj',
'D199.9_7_140.obj',
'D199.9_7_141.obj',
'D199.9_7_142.obj',
'D199.9_7_143.obj',
'D199.9_7_144.obj',
'D199.9_7_145.obj',
'D199.9_7_146.obj',
'D199.9_7_147.obj',
'D199.9_7_148.obj',
'D199.9_7_149.obj',
'D199.9_7_15.obj',
'D199.9_7_150.obj',
'D199.9_7_151.obj',
'D199.9_7_152.obj',
'D199.9_7_153.obj',
'D199.9_7_154.obj',
'D199.9_7_155.obj',
'D199.9_7_156.obj',
'D199.9_7_157.obj',
'D199.9_7_158.obj',
'D199.9_7_159.obj',
'D199.9_7_16.obj',
'D199.9_7_160.obj',
'D199.9_7_161.obj',
'D199.9_7_162.obj',
'D199.9_7_163.obj',
'D199.9_7_164.obj',
'D199.9_7_165.obj',
'D199.9_7_166.obj',
'D199.9_7_167.obj',
'D199.9_7_168.obj',
'D199.9_7_169.obj',
'D199.9_7_17.obj',
'D199.9_7_170.obj',
'D199.9_7_171.obj',
'D199.9_7_172.obj',
'D199.9_7_173.obj',
'D199.9_7_174.obj',
'D199.9_7_175.obj',
'D199.9_7_176.obj',
'D199.9_7_177.obj',
'D199.9_7_178.obj',
'D199.9_7_179.obj',
'D199.9_7_18.obj',
'D199.9_7_180.obj',
'D199.9_7_181.obj',
'D199.9_7_182.obj',
'D199.9_7_183.obj',
'D199.9_7_184.obj',
'D199.9_7_185.obj',
'D199.9_7_186.obj',
'D199.9_7_187.obj',
'D199.9_7_188.obj',
'D199.9_7_189.obj',
'D199.9_7_19.obj',
'D199.9_7_190.obj',
'D199.9_7_191.obj',
'D199.9_7_192.obj',
'D199.9_7_193.obj',
'D199.9_7_194.obj',
'D199.9_7_195.obj',
'D199.9_7_196.obj',
'D199.9_7_197.obj',
'D199.9_7_198.obj',
'D199.9_7_199.obj',
'D199.9_7_2.obj',
'D199.9_7_20.obj',
'D199.9_7_200.obj',
'D199.9_7_201.obj',
'D199.9_7_202.obj',
'D199.9_7_203.obj',
'D199.9_7_204.obj',
'D199.9_7_205.obj',
'D199.9_7_206.obj',
'D199.9_7_207.obj',
'D199.9_7_208.obj',
'D199.9_7_209.obj',
'D199.9_7_21.obj',
'D199.9_7_210.obj',
'D199.9_7_211.obj',
'D199.9_7_212.obj',
'D199.9_7_213.obj',
'D199.9_7_214.obj',
'D199.9_7_215.obj',
'D199.9_7_216.obj',
'D199.9_7_217.obj',
'D199.9_7_218.obj',
'D199.9_7_219.obj',
'D199.9_7_22.obj',
'D199.9_7_220.obj',
'D199.9_7_221.obj',
'D199.9_7_222.obj',
'D199.9_7_223.obj',
'D199.9_7_224.obj',
'D199.9_7_225.obj',
'D199.9_7_226.obj',
'D199.9_7_227.obj',
'D199.9_7_228.obj',
'D199.9_7_229.obj',
'D199.9_7_23.obj',
'D199.9_7_230.obj',
'D199.9_7_24.obj',
'D199.9_7_25.obj',
'D199.9_7_26.obj',
'D199.9_7_27.obj',
'D199.9_7_28.obj',
'D199.9_7_29.obj',
'D199.9_7_3.obj',
'D199.9_7_30.obj',
'D199.9_7_31.obj',
'D199.9_7_32.obj',
'D199.9_7_33.obj',
'D199.9_7_34.obj',
'D199.9_7_35.obj',
'D199.9_7_36.obj',
'D199.9_7_37.obj',
'D199.9_7_38.obj',
'D199.9_7_39.obj',
'D199.9_7_4.obj',
'D199.9_7_40.obj',
'D199.9_7_41.obj',
'D199.9_7_42.obj',
'D199.9_7_43.obj',
'D199.9_7_44.obj',
'D199.9_7_45.obj',
'D199.9_7_46.obj',
'D199.9_7_47.obj',
'D199.9_7_48.obj',
'D199.9_7_49.obj',
'D199.9_7_5.obj',
'D199.9_7_50.obj',
'D199.9_7_51.obj',
'D199.9_7_52.obj',
'D199.9_7_53.obj',
'D199.9_7_54.obj',
'D199.9_7_55.obj',
'D199.9_7_56.obj',
'D199.9_7_57.obj',
'D199.9_7_58.obj',
'D199.9_7_59.obj',
'D199.9_7_6.obj',
'D199.9_7_60.obj',
'D199.9_7_61.obj',
'D199.9_7_62.obj',
'D199.9_7_63.obj',
'D199.9_7_64.obj',
'D199.9_7_65.obj',
'D199.9_7_66.obj',
'D199.9_7_67.obj',
'D199.9_7_68.obj',
'D199.9_7_69.obj',
'D199.9_7_7.obj',
'D199.9_7_70.obj',
'D199.9_7_71.obj',
'D199.9_7_72.obj',
'D199.9_7_73.obj',
'D199.9_7_74.obj',
'D199.9_7_75.obj',
'D199.9_7_76.obj',
'D199.9_7_77.obj',
'D199.9_7_78.obj',
'D199.9_7_79.obj',
'D199.9_7_8.obj',
'D199.9_7_80.obj',
'D199.9_7_81.obj',
'D199.9_7_82.obj',
'D199.9_7_83.obj',
'D199.9_7_84.obj',
'D199.9_7_85.obj',
'D199.9_7_86.obj',
'D199.9_7_87.obj',
'D199.9_7_88.obj',
'D199.9_7_89.obj',
'D199.9_7_9.obj',
'D199.9_7_90.obj',
'D199.9_7_91.obj',
'D199.9_7_92.obj',
'D199.9_7_93.obj',
'D199.9_7_94.obj',
'D199.9_7_95.obj',
'D199.9_7_96.obj',
'D199.9_7_97.obj',
'D199.9_7_98.obj',
'D199.9_7_99.obj',
'D236_7_1.obj',
'D236_7_10.obj',
'D236_7_100.obj',
'D236_7_101.obj',
'D236_7_102.obj',
'D236_7_103.obj',
'D236_7_104.obj',
'D236_7_105.obj',
'D236_7_106.obj',
'D236_7_107.obj',
'D236_7_108.obj',
'D236_7_109.obj',
'D236_7_11.obj',
'D236_7_110.obj',
'D236_7_111.obj',
'D236_7_112.obj',
'D236_7_113.obj',
'D236_7_114.obj',
'D236_7_115.obj',
'D236_7_116.obj',
'D236_7_117.obj',
'D236_7_118.obj',
'D236_7_119.obj',
'D236_7_12.obj',
'D236_7_120.obj',
'D236_7_121.obj',
'D236_7_122.obj',
'D236_7_123.obj',
'D236_7_124.obj',
'D236_7_125.obj',
'D236_7_126.obj',
'D236_7_127.obj',
'D236_7_128.obj',
'D236_7_129.obj',
'D236_7_13.obj',
'D236_7_130.obj',
'D236_7_131.obj',
'D236_7_132.obj',
'D236_7_133.obj',
'D236_7_134.obj',
'D236_7_135.obj',
'D236_7_136.obj',
'D236_7_137.obj',
'D236_7_138.obj',
'D236_7_139.obj',
'D236_7_14.obj',
'D236_7_140.obj',
'D236_7_141.obj',
'D236_7_142.obj',
'D236_7_143.obj',
'D236_7_144.obj',
'D236_7_145.obj',
'D236_7_146.obj',
'D236_7_147.obj',
'D236_7_148.obj',
'D236_7_149.obj',
'D236_7_15.obj',
'D236_7_150.obj',
'D236_7_151.obj',
'D236_7_152.obj',
'D236_7_153.obj',
'D236_7_154.obj',
'D236_7_155.obj',
'D236_7_156.obj',
'D236_7_157.obj',
'D236_7_158.obj',
'D236_7_159.obj',
'D236_7_16.obj',
'D236_7_160.obj',
'D236_7_161.obj',
'D236_7_162.obj',
'D236_7_163.obj',
'D236_7_164.obj',
'D236_7_165.obj',
'D236_7_166.obj',
'D236_7_167.obj',
'D236_7_168.obj',
'D236_7_169.obj',
'D236_7_17.obj',
'D236_7_170.obj',
'D236_7_171.obj',
'D236_7_172.obj',
'D236_7_173.obj',
'D236_7_174.obj',
'D236_7_175.obj',
'D236_7_176.obj',
'D236_7_177.obj',
'D236_7_178.obj',
'D236_7_179.obj',
'D236_7_18.obj',
'D236_7_180.obj',
'D236_7_181.obj',
'D236_7_182.obj',
'D236_7_183.obj',
'D236_7_184.obj',
'D236_7_185.obj',
'D236_7_186.obj',
'D236_7_187.obj',
'D236_7_188.obj',
'D236_7_189.obj',
'D236_7_19.obj',
'D236_7_190.obj',
'D236_7_191.obj',
'D236_7_192.obj',
'D236_7_193.obj',
'D236_7_194.obj',
'D236_7_195.obj',
'D236_7_196.obj',
'D236_7_197.obj',
'D236_7_198.obj',
'D236_7_199.obj',
'D236_7_2.obj',
'D236_7_20.obj',
'D236_7_200.obj',
'D236_7_201.obj',
'D236_7_202.obj',
'D236_7_203.obj',
'D236_7_204.obj',
'D236_7_205.obj',
'D236_7_206.obj',
'D236_7_207.obj',
'D236_7_208.obj',
'D236_7_209.obj',
'D236_7_21.obj',
'D236_7_210.obj',
'D236_7_211.obj',
'D236_7_212.obj',
'D236_7_213.obj',
'D236_7_214.obj',
'D236_7_215.obj',
'D236_7_216.obj',
'D236_7_217.obj',
'D236_7_218.obj',
'D236_7_219.obj',
'D236_7_22.obj',
'D236_7_220.obj',
'D236_7_221.obj',
'D236_7_222.obj',
'D236_7_223.obj',
'D236_7_224.obj',
'D236_7_225.obj',
'D236_7_226.obj',
'D236_7_227.obj',
'D236_7_228.obj',
'D236_7_229.obj',
'D236_7_23.obj',
'D236_7_230.obj',
'D236_7_231.obj',
'D236_7_232.obj',
'D236_7_233.obj',
'D236_7_234.obj',
'D236_7_235.obj',
'D236_7_236.obj',
'D236_7_237.obj',
'D236_7_238.obj',
'D236_7_239.obj',
'D236_7_24.obj',
'D236_7_240.obj',
'D236_7_241.obj',
'D236_7_242.obj',
'D236_7_243.obj',
'D236_7_244.obj',
'D236_7_245.obj',
'D236_7_246.obj',
'D236_7_247.obj',
'D236_7_248.obj',
'D236_7_249.obj',
'D236_7_25.obj',
'D236_7_250.obj',
'D236_7_251.obj',
'D236_7_252.obj',
'D236_7_253.obj',
'D236_7_254.obj',
'D236_7_255.obj',
'D236_7_256.obj',
'D236_7_257.obj',
'D236_7_258.obj',
'D236_7_259.obj',
'D236_7_26.obj',
'D236_7_260.obj',
'D236_7_261.obj',
'D236_7_262.obj',
'D236_7_263.obj',
'D236_7_264.obj',
'D236_7_265.obj',
'D236_7_266.obj',
'D236_7_267.obj',
'D236_7_268.obj',
'D236_7_269.obj',
'D236_7_27.obj',
'D236_7_270.obj',
'D236_7_271.obj',
'D236_7_272.obj',
'D236_7_273.obj',
'D236_7_274.obj',
'D236_7_275.obj',
'D236_7_276.obj',
'D236_7_277.obj',
'D236_7_278.obj',
'D236_7_279.obj',
'D236_7_28.obj',
'D236_7_280.obj',
'D236_7_281.obj',
'D236_7_282.obj',
'D236_7_283.obj',
'D236_7_284.obj',
'D236_7_285.obj',
'D236_7_286.obj',
'D236_7_287.obj',
'D236_7_288.obj',
'D236_7_289.obj',
'D236_7_29.obj',
'D236_7_290.obj',
'D236_7_291.obj',
'D236_7_292.obj',
'D236_7_293.obj',
'D236_7_294.obj',
'D236_7_295.obj',
'D236_7_296.obj',
'D236_7_297.obj',
'D236_7_298.obj',
'D236_7_299.obj',
'D236_7_3.obj',
'D236_7_30.obj',
'D236_7_300.obj',
'D236_7_31.obj',
'D236_7_32.obj',
'D236_7_33.obj',
'D236_7_34.obj',
'D236_7_35.obj',
'D236_7_36.obj',
'D236_7_37.obj',
'D236_7_38.obj',
'D236_7_39.obj',
'D236_7_4.obj',
'D236_7_40.obj',
'D236_7_41.obj',
'D236_7_42.obj',
'D236_7_43.obj',
'D236_7_44.obj',
'D236_7_45.obj',
'D236_7_46.obj',
'D236_7_47.obj',
'D236_7_48.obj',
'D236_7_49.obj',
'D236_7_5.obj',
'D236_7_50.obj',
'D236_7_51.obj',
'D236_7_52.obj',
'D236_7_53.obj',
'D236_7_54.obj',
'D236_7_55.obj',
'D236_7_56.obj',
'D236_7_57.obj',
'D236_7_58.obj',
'D236_7_59.obj',
'D236_7_6.obj',
'D236_7_60.obj',
'D236_7_61.obj',
'D236_7_62.obj',
'D236_7_63.obj',
'D236_7_64.obj',
'D236_7_65.obj',
'D236_7_66.obj',
'D236_7_67.obj',
'D236_7_68.obj',
'D236_7_69.obj',
'D236_7_7.obj',
'D236_7_70.obj',
'D236_7_71.obj',
'D236_7_72.obj',
'D236_7_73.obj',
'D236_7_74.obj',
'D236_7_75.obj',
'D236_7_76.obj',
'D236_7_77.obj',
'D236_7_78.obj',
'D236_7_79.obj',
'D236_7_8.obj',
'D236_7_80.obj',
'D236_7_81.obj',
'D236_7_82.obj',
'D236_7_83.obj',
'D236_7_84.obj',
'D236_7_85.obj',
'D236_7_86.obj',
'D236_7_87.obj',
'D236_7_88.obj',
'D236_7_89.obj',
'D236_7_9.obj',
'D236_7_90.obj',
'D236_7_91.obj',
'D236_7_92.obj',
'D236_7_93.obj',
'D236_7_94.obj',
'D236_7_95.obj',
'D236_7_96.obj',
'D236_7_97.obj',
'D236_7_98.obj',
'D236_7_99.obj',
'D280_300_1.obj',
'D280_300_10.obj',
'D280_300_11.obj',
'D280_300_12.obj',
'D280_300_13.obj',
'D280_300_14.obj',
'D280_300_15.obj',
'D280_300_16.obj',
'D280_300_17.obj',
'D280_300_18.obj',
'D280_300_19.obj',
'D280_300_2.obj',
'D280_300_20.obj',
'D280_300_21.obj',
'D280_300_22.obj',
'D280_300_23.obj',
'D280_300_24.obj',
'D280_300_25.obj',
'D280_300_26.obj',
'D280_300_27.obj',
'D280_300_28.obj',
'D280_300_29.obj',
'D280_300_3.obj',
'D280_300_30.obj',
'D280_300_31.obj',
'D280_300_32.obj',
'D280_300_33.obj',
'D280_300_34.obj',
'D280_300_35.obj',
'D280_300_36.obj',
'D280_300_37.obj',
'D280_300_38.obj',
'D280_300_39.obj',
'D280_300_4.obj',
'D280_300_40.obj',
'D280_300_41.obj',
'D280_300_42.obj',
'D280_300_43.obj',
'D280_300_44.obj',
'D280_300_45.obj',
'D280_300_46.obj',
'D280_300_47.obj',
'D280_300_48.obj',
'D280_300_49.obj',
'D280_300_5.obj',
'D280_300_50.obj',
'D280_300_51.obj',
'D280_300_52.obj',
'D280_300_53.obj',
'D280_300_54.obj',
'D280_300_55.obj',
'D280_300_56.obj',
'D280_300_57.obj',
'D280_300_58.obj',
'D280_300_59.obj',
'D280_300_6.obj',
'D280_300_60.obj',
'D280_300_61.obj',
'D280_300_62.obj',
'D280_300_7.obj',
'D280_300_8.obj',
'D280_300_9.obj',
'D35_35_1.obj',
'D35_35_2.obj',
'D35_35_3.obj',
'D35_35_4.obj',
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
// 全局变量定义（新增 sceneContainer 和物料列表相关变量）
let scene, camera, renderer, raycaster, mouse, orbitControls;
let transparentBox, allModels = [];
const OBJECT_DIR = './Objects6/';
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
            '1000_1000_0.5_1.obj',
'1000_1000_0.5_2.obj',
'1000_1000_0.5_3.obj',
'178.04_118.9_45_1.obj',
'178.04_118.9_45_2.obj',
'178.04_118.9_45_3.obj',
'178.04_118.9_45_4.obj',
'178.04_118.9_45_5.obj',
'178.04_118.9_45_6.obj',
'20_20_20_1.obj',
'20_20_20_2.obj',
'237_203_130_1.obj',
'237_203_130_2.obj',
'237_203_130_3.obj',
'237_203_130_4.obj',
'237_203_130_5.obj',
'270_150_100_1.obj',
'270_150_100_10.obj',
'270_150_100_11.obj',
'270_150_100_12.obj',
'270_150_100_13.obj',
'270_150_100_14.obj',
'270_150_100_15.obj',
'270_150_100_16.obj',
'270_150_100_17.obj',
'270_150_100_18.obj',
'270_150_100_2.obj',
'270_150_100_3.obj',
'270_150_100_4.obj',
'270_150_100_5.obj',
'270_150_100_6.obj',
'270_150_100_7.obj',
'270_150_100_8.obj',
'270_150_100_9.obj',
'394_320_211_1.obj',
'394_320_211_10.obj',
'394_320_211_11.obj',
'394_320_211_12.obj',
'394_320_211_13.obj',
'394_320_211_14.obj',
'394_320_211_15.obj',
'394_320_211_16.obj',
'394_320_211_17.obj',
'394_320_211_18.obj',
'394_320_211_19.obj',
'394_320_211_2.obj',
'394_320_211_3.obj',
'394_320_211_4.obj',
'394_320_211_5.obj',
'394_320_211_6.obj',
'394_320_211_7.obj',
'394_320_211_8.obj',
'394_320_211_9.obj',
'490_370_329_1.obj',
'490_370_329_10.obj',
'490_370_329_11.obj',
'490_370_329_12.obj',
'490_370_329_2.obj',
'490_370_329_3.obj',
'490_370_329_4.obj',
'490_370_329_5.obj',
'490_370_329_6.obj',
'490_370_329_7.obj',
'490_370_329_8.obj',
'490_370_329_9.obj',
'50_35_35_1.obj',
'50_50_35_1.obj',
'842_760_40_1.obj',
'D110_9.2_1.obj',
'D110_9.2_10.obj',
'D110_9.2_11.obj',
'D110_9.2_12.obj',
'D110_9.2_13.obj',
'D110_9.2_14.obj',
'D110_9.2_15.obj',
'D110_9.2_16.obj',
'D110_9.2_17.obj',
'D110_9.2_18.obj',
'D110_9.2_19.obj',
'D110_9.2_2.obj',
'D110_9.2_20.obj',
'D110_9.2_21.obj',
'D110_9.2_22.obj',
'D110_9.2_3.obj',
'D110_9.2_4.obj',
'D110_9.2_5.obj',
'D110_9.2_6.obj',
'D110_9.2_7.obj',
'D110_9.2_8.obj',
'D110_9.2_9.obj',
'D140_5_1.obj',
'D181_d160_40_1.obj',
'D181_d160_40_2.obj',
'D181_d160_40_3.obj',
'D185_d175_565_1.obj',
'D188_24_1.obj',
'D188_24_2.obj',
'D188_24_3.obj',
'D188_24_4.obj',
'D193_d170_40_1.obj',
'D193_d170_40_2.obj',
'D197_d175_15_1.obj',
'D197_d175_15_2.obj',
'D19_253_1.obj',
'D19_253_10.obj',
'D19_253_2.obj',
'D19_253_3.obj',
'D19_253_4.obj',
'D19_253_5.obj',
'D19_253_6.obj',
'D19_253_7.obj',
'D19_253_8.obj',
'D19_253_9.obj',
'D200_5_1.obj',
'D206_d40_224.5_1.obj',
'D206_d40_224.5_10.obj',
'D206_d40_224.5_2.obj',
'D206_d40_224.5_3.obj',
'D206_d40_224.5_4.obj',
'D206_d40_224.5_5.obj',
'D206_d40_224.5_6.obj',
'D206_d40_224.5_7.obj',
'D206_d40_224.5_8.obj',
'D206_d40_224.5_9.obj',
'D238_d208.5_45_1.obj',
'D238_d208.5_45_2.obj',
'D238_d213_45_1.obj',
'D238_d213_45_2.obj',
'D249.95_d181_5_1.obj',
'D249.95_d181_5_10.obj',
'D249.95_d181_5_2.obj',
'D249.95_d181_5_3.obj',
'D249.95_d181_5_4.obj',
'D249.95_d181_5_5.obj',
'D249.95_d181_5_6.obj',
'D249.95_d181_5_7.obj',
'D249.95_d181_5_8.obj',
'D249.95_d181_5_9.obj',
'D250_d150_260_1.obj',
'D250_d160_260_1.obj',
'D250_d160_260_2.obj',
'D308_d230_105_1.obj',
'D380_d18_2_1.obj',
'D380_d18_2_2.obj',
'D380_d18_2_3.obj',
'D39_25_1.obj',
'D39_25_2.obj',
'D39_25_3.obj',
'D39_25_4.obj',
'D39_25_5.obj',
'D39_25_6.obj',
'D56_40_1.obj',
'D56_40_2.obj',
'D56_40_3.obj',
'D660_d260_416.8_1.obj',
'D660_d260_416.8_2.obj',
'D98_d40_198(1)_1.obj',
'D98_d40_198(1)_2.obj',
'D98_d40_198(1)_3.obj',
'D98_d40_198(1)_4.obj',
'D98_d40_198(1)_5.obj',
'D98_d40_198(1)_6.obj',
'D98_d40_198(1)_7.obj',
'D98_d40_198_1.obj',
'D98_d40_198_2.obj',
'D98_d40_198_3.obj',
'D98_d40_198_4.obj',
'D98_d40_198_5.obj',
'D98_d50_198_1.obj',
'D98_d50_198_2.obj',
'D98_d50_198_3.obj',
'D98_d50_198_4.obj',
'D98_d50_198_5.obj',
'disk1000.obj',
'disk1400.obj',
'disk600.obj',
'pillars.obj',
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
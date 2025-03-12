var echarts = require('echarts');
require('echarts-gl');

var ROOT_PATH = 'https://echarts.apache.org/examples';

var chartDom = document.getElementById('earth');
var myChart = echarts.init(chartDom);
var option;

$.getJSON(ROOT_PATH + '/data-gl/asset/data/population.json', function (data) {
    console.log(123);
  data = data
    .filter(function (dataItem) {
      return dataItem[2] > 0;
    })
    .map(function (dataItem) {
      return [dataItem[0], dataItem[1], Math.sqrt(dataItem[2])];
    });
  myChart.setOption({
    visualMap: {
      show: false,
      min: 0,
      max: 60,
      inRange: {
        symbolSize: [1.0, 10.0]
      }
    },
    globe: {
      environment: ROOT_PATH + '/data-gl/asset/starfield.jpg',
      heightTexture:
        ROOT_PATH + '/data-gl/asset/bathymetry_bw_composite_4k.jpg',
      displacementScale: 0.05,
      displacementQuality: 'high',
      globeOuterRadius: 100,
      baseColor: '#000',
      shading: 'realistic',
      realisticMaterial: {
        roughness: 0.2,
        metalness: 0
      },
      postEffect: {
        enable: true,
        depthOfField: {
          focalRange: 15,
          enable: true,
          focalDistance: 100
        }
      },
      temporalSuperSampling: {
        enable: true
      },
      light: {
        ambient: {
          intensity: 0
        },
        main: {
          intensity: 0.1,
          shadow: false
        },
        ambientCubemap: {
          texture: ROOT_PATH + '/data-gl/asset/lake.hdr',
          exposure: 1,
          diffuseIntensity: 0.5,
          specularIntensity: 2
        }
      },
      viewControl: {
        autoRotate: false,
        beta: 180,
        alpha: 20,
        distance: 100
      }
    },
    series: {
      type: 'scatter3D',
      pointSize: 700,
      blurSize: 700,
      coordinateSystem: 'globe',
      blendMode: 'lighter',
      symbolSize: 200,
      itemStyle: {
        emphasis: {
          areaColor: '#2B91B7'
        }
      },
      data: data
    }
  });
});

myChart.setOption(option);

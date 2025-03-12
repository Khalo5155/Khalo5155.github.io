// Chart 1 陨石数量-年代-纬度分布（fljy）
(function() {
    // 实例化对象
    var myChart = echarts.init(document.getElementById("world_chart_1"));

    
    // 数据集
    var data_NorthAmerica = [
      [0,0,0,0,0,0,0,0,0,0,1,11,30,158,47,3,0,1,0],
      [0,0,0,0,0,0,0,0,0,0,0,9,85,925,159,23,5,2,1],
      [0,0,0,0,0,0,0,0,0,0,0,0,3,272,26,3,0,0,0,]
    ];
    var data_SouthAmerica = [
      [0,0,0,0,0,1,4,31,3,2,1,0,0,0,0,0,0,0,0,],
      [0,0,0,0,1,7,36,55,17,6,2,0,0,0,0,0,0,0,0,],
      [0,0,0,0,0,2,4,354,4,1,1,0,0,0,0,0,0,0,0,]
    ];
    var data_Europe = [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,20,145,78,3,0,0,],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,28,93,80,19,1,0,],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,3,19,28,0,0,0,]
    ];
    var data_Asia = [
      [0,0,0,0,0,0,0,0,0,0,3,19,54,24,2,10,0,0,0,],
      [0,0,0,0,0,0,0,0,0,0,3,18,72,82,32,42,16,1,0,],
      [0,0,0,0,0,0,0,0,0,0,1,4,10,6,7,3,1,0,0,]
    ];
    var data_Africa = [
      [0,0,0,0,0,0,9,5,2,1,1,1,3,1,0,0,0,0,0,],
      [0,0,0,0,0,0,17,32,13,235,31,191,1804,48,0,0,0,0,0,],
      [0,0,0,0,0,0,0,2,1,1,1,1959,809,77,0,0,0,0,0,]
    ];
    var data_Oceania = [
      [0,0,0,0,0,4,17,7,0,5,0,0,0,0,0,0,0,0,0,],
      [0,0,0,0,0,7,458,85,6,15,0,0,0,0,0,0,0,0,0,],
      [0,0,0,0,0,0,53,3,0,1,0,0,0,0,0,0,0,0,0,]
    ];
    var data_World = [
      [0,0,0,0,0,5,30,43,5,8,6,31,87,203,194,91,3,1,0],
      [0,6623,10921,1,1,14,513,173,37,256,36,219,1962,1084,288,150,40,4,1],
      [0,1684,2868,0,0,2,57,363,5,3,3,2293,1101,426,57,37,1,0,0]
    ];
    var data_all = [data_NorthAmerica, data_SouthAmerica, data_Europe, data_Asia, data_Africa, data_Oceania, data_World];
    

    // 指定配置和数据
    var option = {
        title: {
            text: 'Number-Time-Latitude Distribution',
            left: 'center',
            textStyle: {
              color: "#eee",
            },
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'cross',
            label: {
              backgroundColor: '#6a7985'
            }
          }
        },
        grid: {
          left: '0%',
          right: '4%',
          bottom: '7%',
          containLabel: true,
        },
        xAxis: [
            {
                type: 'category',
                boundaryGap: false,
                data: [
                  -90,-80,-70,-60,-50,-40,-30,-20,-10,0,10,20,30,40,50,60,70,80,90
                ],
                axisLabel: {
                    color: '#ccc',
                },
                axisLine: {
                    lineStyle: {
                        color: '#ccc'
                    }
                },
                splitLine: {
                    lineStyle: {
                        color: '#777'
                    }
                }
            }
        ],
        yAxis: [
            {
                type: 'value',
                axisLabel: {
                    color: '#ccc'
                },
                axisLine: {
                    lineStyle: {
                        color: '#ccc'
                    },
                },
                splitLine: {
                    lineStyle: {
                        color: '#777'
                    }
                }
            }
        ],
        series: [
          {
            name: 'before1900',
            type: 'line',
            stack: 'Total',
            areaStyle: {},
            emphasis: {
              focus: 'series'
            },
            data: data_World[0]
          },{
            name: '1900s',
            type: 'line',
            stack: 'Total',
            areaStyle: {},
            emphasis: {
              focus: 'series'
            },
            data: data_World[1]
          },{
            name: '2000s',
            type: 'line',
            stack: 'Total',
            areaStyle: {},
            emphasis: {
              focus: 'series'
            },
            data: data_World[2]
          }
        ]
    };
  
    myChart.setOption(option);
    window.addEventListener("resize", function() {
      myChart.resize();
    });



    
    /*-------------------------------------------------------------------*/
    /*----- 切换大洲视角，id 0~5 代表切换到对应大洲视角，6 代表全球视角。-----*/
    /*-------------------------------------------------------------------*/
    continent_list = ["NorthAmerica", "SouthAmerica", "Europe", "Asia", "Africa", "Oceania", "World"];
    function ContinentToggle(id) {
      // console.log(id);
      var data = data_all[id];
      option.series[0].data = data[0];
      option.series[1].data = data[1];
      option.series[2].data = data[2];
      myChart.setOption(option);
    }
    function UpdateChart() {
      currentId = document.getElementById("current_continent_id").innerHTML;
      // console.log('chart1 changed to',continent_list[currentId]);
      ContinentToggle(currentId);
    }



    /*-----------------------------------*/
    /*------------ 监听id变化 ------------*/
    /*-----------------------------------*/
    id_recorder = document.getElementById("current_continent_id");
    // 创建一个 MutationObserver 实例
    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
          if (mutation.type === 'childList' || mutation.type === 'subtree') {
              // 当 innerHTML 变化时执行的函数
              handleChange();
          }
        }
    });
    // 配置观察选项
    const config = {
      childList: true, // 观察子节点的变化
      subtree : true,   // 观察所有后代节点
    };
    // 启动观察
    observer.observe(id_recorder, config);
    // 定义变化时执行的函数
    function handleChange() {
      // console.log('innerHTML has changed:', id_recorder.innerHTML);
      UpdateChart();
    }
    // 在页面关闭时停止观察
    window.addEventListener('beforeunload', () => {
      observer.disconnect();
    });
    
})();

// Chart 2 陨石类别数量饼图（wzw, ytx)
(function() {
  var chart = echarts.init(document.getElementById('world_chart_2'));

  var meteoriteData_NorthAmerica = [
    {"name":"others","value":485},
    {"name":"H5","value":295},
    {"name":"L6","value":278},
    {"name":"H4","value":187},
    {"name":"L5","value":137},
    {"name":"H6","value":132},
    {"name":"Iron, IIIAB","value":124},
    {"name":"L4","value":53},
    {"name":"OC","value":43},
    {"name":"Iron, IIAB","value":42},
    {"name":"Iron, IAB-MG","value":38}
  ];

  var meteoriteData_SouthAmerica = [
    {"name":"others","value":135},
    {"name":"H5","value":107},
    {"name":"L6","value":92},
    {"name":"H4","value":55},
    {"name":"H6","value":43},
    {"name":"L5","value":29},
    {"name":"Iron, IIIAB","value":24},
    {"name":"L4","value":16},
    {"name":"H~5","value":13},
    {"name":"L~6","value":12},
    {"name":"LL6","value":10}
  ];

  var meteoriteData_Europe = [
    {"name":"others","value":185},
    {"name":"L6","value":114},
    {"name":"H5","value":67},
    {"name":"H4","value":33},
    {"name":"L5","value":30},
    {"name":"H6","value":30},
    {"name":"Relict OC","value":17},
    {"name":"Iron, IIIAB","value":16},
    {"name":"LL6","value":15},
    {"name":"Stone-uncl","value":11},
    {"name":"LL5","value":10}
  ];

  var meteoriteData_Asia = [
    {"name":"others","value":147},
    {"name":"L6","value":69},
    {"name":"H5","value":56},
    {"name":"H6","value":35},
    {"name":"L5","value":26},
    {"name":"Iron, IIIAB","value":21},
    {"name":"H4","value":18},
    {"name":"Iron","value":12},
    {"name":"Stone-uncl","value":11},
    {"name":"LL6","value":10},
    {"name":"Iron, ungrouped","value":8}
  ];

  var meteoriteData_Africa = [
    {"name":"others","value":1504},
    {"name":"L6","value":1099},
    {"name":"H5","value":1035},
    {"name":"H6","value":774},
    {"name":"H4","value":466},
    {"name":"L5","value":384},
    {"name":"L4","value":182},
    {"name":"LL6","value":157},
    {"name":"H5/6","value":117},
    {"name":"H4/5","value":84},
    {"name":"H~5","value":76}
  ];

  var meteoriteData_Oceania = [
    {"name":"others","value":191},
    {"name":"L6","value":129},
    {"name":"H5","value":111},
    {"name":"L5","value":48},
    {"name":"H6","value":47},
    {"name":"H4","value":45},
    {"name":"Iron, IIIAB","value":28},
    {"name":"L4","value":26},
    {"name":"LL6","value":18},
    {"name":"Iron, ungrouped","value":11},
    {"name":"H4/5","value":10}
  ];

  var meteoriteData_World = [
    {"name":"others","value":6225},
    {"name":"L6","value":6523},
    {"name":"H5","value":5586},
    {"name":"H4","value":3324},
    {"name":"H6","value":3231},
    {"name":"L5","value":2723},
    {"name":"LL5","value":1897},
    {"name":"LL6","value":963},
    {"name":"L4","value":799},
    {"name":"H4/5","value":380},
    {"name":"CM2","value":279},
  ];
  var data_all = [meteoriteData_NorthAmerica, meteoriteData_SouthAmerica, meteoriteData_Europe,
    meteoriteData_Asia, meteoriteData_Africa, meteoriteData_Oceania, meteoriteData_World
  ];
  
  var option = {
      title: {
          text: 'Top 10 Meteorite Classifications',
          left: 'center',
          textStyle: {
            color: "#ccc",
          },
      },
      tooltip: {
          trigger: 'item',
          formatter: '{a} <br/>{b}: {c} ({d}%)'
      },
      legend: {
          orient: 'vertical',
          left: 'left',
          top: '15%',
          data: meteoriteData_World.map(item => item.name),
          textStyle: {
            color: "#ccc",
          },
      },
      series: [{
          name: 'Meteorite Classification',
          type: 'pie',
          radius: '50%',
          data: meteoriteData_World,
          center: ['60%', '55%'],
          emphasis: {
              itemStyle: {
                  shadowBlur: 10,
                  shadowOffsetX: 0,
                  shadowColor: 'rgba(0, 0, 0, 0.5)'
              }
          }
      }]
  };

  chart.setOption(option);
  window.addEventListener("resize", function() {
    chart.resize();
  });



  /*-------------------------------------------------------------------*/
  /*----- 切换大洲视角，id 0~5 代表切换到对应大洲视角，6 代表全球视角。-----*/
  /*-------------------------------------------------------------------*/
  continent_list = ["NorthAmerica", "SouthAmerica", "Europe", "Asia", "Africa", "Oceania", "World"];
  function ContinentToggle(id) {
    var data = data_all[id];
    option.legend.data = data.map(item => item.name);
    option.series[0].data = data;
    chart.setOption(option);
  }
  function UpdateChart() {
    currentId = document.getElementById("current_continent_id").innerHTML;
    // console.log('chart2 changed to',continent_list[currentId]);
    ContinentToggle(currentId);
  }



  /*-----------------------------------*/
  /*------------ 监听id变化 ------------*/
  /*-----------------------------------*/
  id_recorder = document.getElementById("current_continent_id");
  // 创建一个 MutationObserver 实例
  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList' || mutation.type === 'subtree') {
            // 当 innerHTML 变化时执行的函数
            handleChange();
        }
      }
  });
  // 配置观察选项
  const config = {
    childList: true, // 观察子节点的变化
    subtree : true,   // 观察所有后代节点
  };
  // 启动观察
  observer.observe(id_recorder, config);
  // 定义变化时执行的函数
  function handleChange() {
    // console.log('innerHTML has changed:', id_recorder.innerHTML);
    UpdateChart();
  }
  // 在页面关闭时停止观察
  window.addEventListener('beforeunload', () => {
    observer.disconnect();
  });
})();

// Chart 3 陨石质量年份分布（gqy）
(function() {
    var myChart = echarts.init(document.getElementById('world_chart_3'));

    // 数据集
    var data_NorthAmerica = [0, 10100000, 0, 3000000, 1000000, 60634300, 3967300, 27080400, 27274620, 39533840, 21444405, 11932351];
    var data_SouthAmerica = [50000000, 0, 0, 0, 5360000, 825000, 920000, 12000, 11555230, 130800, 453250, 3867600];
    var data_Europe = [0, 0, 87700, 19000, 25000, 2755300, 1008500, 885750, 1478700, 2242810, 1438700, 965970];
    var data_Asia = [0, 0, 714360, 0, 158500, 13200, 43650, 300880, 308700, 28965350, 1237117, 660866];
    var data_Africa = [0, 0, 0, 0, 136000, 0, 26000000, 148800, 3060000, 508500, 62161780, 76551000];
    var data_Oceania = [0, 0, 0, 0, 500000, 0, 0, 8832200, 221621, 4497001, 27521760, 5629130];
    var data_World = [50000000, 10100000, 802060, 3019000, 7179500, 64227800, 31939450, 37260030, 43898871, 75878301, 114257012, 99606917];
    var data_all = [data_NorthAmerica, data_SouthAmerica, data_Europe, data_Asia, data_Africa, data_Oceania, data_World];

    // 指定图表的配置项和数据
    var option = {
      title: {
        text: 'Mass Distribution-Time',
        left: 'center',
        textStyle: {
          color: "#eee",
        },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        }
      },
      grid: {
        left: '0%',
        right: '4%',
        bottom: '7%',
        containLabel: true,
      },
      xAxis: {
        axisLabel: {
          color: '#ccc',
          rotate: 30,  // 旋转标签以避免重叠
        },
        axisLine: {
          lineStyle: {
            color: '#ccc'
          }
        },
        splitLine: {
          lineStyle: {
            color: '#777'
          }
        },
        data: ['1560-1580', '1600-1620', '1740-1760', '1760-1780', '1780-1800', '1800-1820', '1820-1840',
          '1840-1860', '1860-1880', '1880-1900', '1900-1920','1920-1940']
      },
      yAxis: {
        axisLabel: {
          color: '#ccc',
        },
        axisLine: {
          lineStyle: {
            color: '#ccc'
          }
        },
        splitLine: {
          lineStyle: {
            color: '#777'
          }
        },
      },
      series: [{
        name: 'total mass',
        type: 'bar',
        data: data_World,
        itemStyle: {
          color: 'rgba(201,91,82,0.9)'
        }
      }]
    };

    myChart.setOption(option);
    window.addEventListener("resize", function() {
      myChart.resize();
    });

    /*-------------------------------------------------------------------*/
    /*----- 切换大洲视角，id 0~5 代表切换到对应大洲视角，6 代表全球视角。-----*/
    /*-------------------------------------------------------------------*/
    continent_list = ["NorthAmerica", "SouthAmerica", "Europe", "Asia", "Africa", "Oceania", "World"];
    function ContinentToggle(id) {
      var data = data_all[id];
      option.series[0].data = data;
      myChart.setOption(option);
    }
    function UpdateChart() {
      currentId = document.getElementById("current_continent_id").innerHTML;
      // console.log('chart3 changed to',continent_list[currentId]);
      ContinentToggle(currentId);
    }



    /*-----------------------------------*/
    /*------------ 监听id变化 ------------*/
    /*-----------------------------------*/
    id_recorder = document.getElementById("current_continent_id");
    // 创建一个 MutationObserver 实例
    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
          if (mutation.type === 'childList' || mutation.type === 'subtree') {
              // 当 innerHTML 变化时执行的函数
              handleChange();
          }
        }
    });
    // 配置观察选项
    const config = {
      childList: true, // 观察子节点的变化
      subtree : true,   // 观察所有后代节点
    };
    // 启动观察
    observer.observe(id_recorder, config);
    // 定义变化时执行的函数
    function handleChange() {
      // console.log('innerHTML has changed:', id_recorder.innerHTML);
      UpdateChart();
    }
    // 在页面关闭时停止观察
    window.addEventListener('beforeunload', () => {
      observer.disconnect();
    });
})();

// Chart 4 陨石种类数量-质量分布（fljy)
(function() {
    var myChart = echarts.init(document.getElementById('world_chart_4'));

    // 数据集
    var data_NorthAmerica = [
      ['H5', 'L6', 'H4', 'L5', 'H6', 'Iron, IIIAB', 'L4', 'OC', 'Iron, IIAB', 'Iron, IAB-MG'],
      [12463.65,14704.08,7572.18,13337.13,12554.91,977475.4,8326.98,1094.2,201822.37,880868.84],
      [295,278,187,137,132,124,53,43,42,38]
    ];
    var data_SouthAmerica = [
      ['H5','L6','H4','H6','L5','Iron, IIIAB','L4','H~5','L~6','LL6'],
      [3538.08,7493.05,1128.32,2050.49,18661.41,74981.79,2785.83,1991.23,371.17,298.66],
      [107,92,55,43,29,24,16,13,12,10]
    ];
    var data_Europe = [
      ['L6','H5','H4','H6','L5','Relict OC','Iron, IIIAB','LL6','Stone-uncl','L4'],
      [9863.27,31245.93,26485.5,11087.37,52766.78,0.0,102457.86,32827.37,10084.39,27157.95],
      [114,67,33,30,30,17,16,15,11,10],
    ];
    var data_Asia = [
      ['L6','H5','H6','L5','Iron, IIIAB','H4','Iron','Stone-uncl','LL6','Iron, IVA'],
      [13430.22,80958.15,8865.17,6990.4,135274.22,15116.58,43822.02,18787.92,17058.6,408048.12],
      [69,56,35,26,21,18,12,11,10,8],
    ];
    var data_Africa = [
      ['L6','H5','H6','H4','L5','L4','LL6','H5/6','H4/5','H~5'],
      [2281.6,1878.8,804.81,1154.5,8249.69,1221.94,1706.61,921.59,4560.34,824.82],
      [1099,1035,774,466,384,182,157,117,84,76]
    ];
    var data_Oceania = [
      ['L6','H5','L5','H6','H4','Iron, IIIAB','L4','LL6','Iron, ungrouped','H4/5'],
      [5052.71,10413.76,2438.01,6851.89,4990.06,179606.25,22398.59,3703.59,55119.43,3961.87],
      [129,111,48,47,45,28,26,18,11,10]
    ];
    var data_World = [
      ['L6', 'H5', 'H4', 'H6', 'L5', 'LL5', 'LL6', 'L4', 'H4/5', 'CM2'], //classes
      [1708.34,2563.56,1098.06,1112.69,2832.23,504.14,1247.39,2130.27,1758.71,536.11], //meanmass
      [6523,5586,3324,3231,2723,1897,963,799,380,279], //count
    ];
    var data_all = [data_NorthAmerica, data_SouthAmerica, data_Europe, data_Asia, data_Africa, data_Oceania, data_World];

    // 指定图表的配置项和数据
    var option = {
      color: ['#67F9D8', '#FFE434', '#56A3F1', '#FF917C'],
      title: {
        text: 'Mass&Count Distribution-Class',
        left: 'center',
        textStyle: {
          color: "#ccc",
        },
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        top: '10%',
        textStyle: {
          color: "#ccc",
        },
      },
      radar: [
        {
          indicator: [
            {text: 'L6'},
            {text: 'H5'},
            {text: 'H4'},
            {text: 'H6'},
            {text: 'L5'},
            {text: 'LL5'},
            {text: 'LL6'},
            {text: 'L4'},
            {text: 'H4/5'},
            {text: 'CM2'},
          ],
          center: ['50%', '50%'],
          radius: 120,
          startAngle: 90,
          splitNumber: 4,
          shape: 'circle',
          axisName: {
            formatter: '【{value}】',
            color: '#428BD4'
          },
          splitArea: {
            show: false
          },
          axisLine: {
            lineStyle: {
              color: 'rgba(211, 253, 250, 0.8)',
              width: 1,
              opacity: 0.5
            }
          },
          splitLine: {
            lineStyle: {
              color: [
                'rgba(238, 197, 102, 0.1)',
                'rgba(238, 197, 102, 0.2)',
                'rgba(238, 197, 102, 0.4)',
                'rgba(238, 197, 102, 0.6)',
                'rgba(238, 197, 102, 0.8)',
                'rgba(238, 197, 102, 1)'
              ].reverse()
            }
          },
        }
      ],
      series: [
        {
          type: 'radar',
          areaStyle: {
            opacity: 0.1
          },
          emphasis: {
            lineStyle: {
              width: 2
            }
          },
          data: [
            {
              value: [
                1708.34,2563.56,1098.06,1112.69,2832.23,504.14,1247.39,2130.27,1758.71,536.11  
              ],
              name: 'mean mass'
            },
            {
              value: [
                6523,5586,3324,3231,2723,1897,963,799,380,279  
              ],
              name: 'count',
              areaStyle: {
                color: 'rgba(255, 228, 52, 0.6)'
              }
            }
          ]
        }
      ]
    };

    myChart.setOption(option);
    window.addEventListener("resize", function() {
      myChart.resize();
    });

    /*-------------------------------------------------------------------*/
    /*----- 切换大洲视角，id 0~5 代表切换到对应大洲视角，6 代表全球视角。-----*/
    /*-------------------------------------------------------------------*/
    continent_list = ["NorthAmerica", "SouthAmerica", "Europe", "Asia", "Africa", "Oceania", "World"];
    function ContinentToggle(id) {
      var data = data_all[id];
      option = {
        color: ['#67F9D8', '#FFE434', '#56A3F1', '#FF917C'],
        title: {
          text: 'Mass&Count Distribution-Class',
          left: 'center',
          textStyle: {
            color: "#ccc",
          },
        },
        legend: {
          orient: 'vertical',
          left: 'left',
          top: '10%',
          textStyle: {
            color: "#ccc",
          },
        },
        radar: [
          {
            indicator: [
              {text: data[0][0]},
              {text: data[0][1]},
              {text: data[0][2]},
              {text: data[0][3]},
              {text: data[0][4]},
              {text: data[0][5]},
              {text: data[0][6]},
              {text: data[0][7]},
              {text: data[0][8]},
              {text: data[0][9]},
            ],
            center: ['50%', '50%'],
            radius: 120,
            startAngle: 90,
            splitNumber: 4,
            shape: 'circle',
            axisName: {
              formatter: '【{value}】',
              color: '#428BD4'
            },
            splitArea: {
              show: false
            },
            axisLine: {
              lineStyle: {
                color: 'rgba(211, 253, 250, 0.8)',
                width: 1,
                opacity: 0.5
              }
            },
            splitLine: {
              lineStyle: {
                color: [
                  'rgba(238, 197, 102, 0.1)',
                  'rgba(238, 197, 102, 0.2)',
                  'rgba(238, 197, 102, 0.4)',
                  'rgba(238, 197, 102, 0.6)',
                  'rgba(238, 197, 102, 0.8)',
                  'rgba(238, 197, 102, 1)'
                ].reverse()
              }
            },
          }
        ],
        series: [
          {
            type: 'radar',
            areaStyle: {
              opacity: 0.1
            },
            emphasis: {
              lineStyle: {
                width: 2
              }
            },
            data: [
              {
                value: data[1],
                name: 'mean mass'
              },
              {
                value: data[2],
                name: 'count',
                areaStyle: {
                  color: 'rgba(255, 228, 52, 0.6)'
                }
              }
            ]
          }
        ]
      };
      // option.radar.indicator = [
      //   {text: data[0][0]},
      //   {text: data[0][1]},
      //   {text: data[0][2]},
      //   {text: data[0][3]},
      //   {text: data[0][4]},
      //   {text: data[0][5]},
      //   {text: data[0][6]},
      //   {text: data[0][7]},
      //   {text: data[0][8]},
      //   {text: data[0][9]},
      // ];
      // option.series[0].data[0].value = data[1];
      // option.series[0].data[1].value = data[2];
      myChart.setOption(option);
    }
    function UpdateChart() {
      currentId = document.getElementById("current_continent_id").innerHTML;
      // console.log('chart4 changed to',continent_list[currentId]);
      ContinentToggle(currentId);
    }



    /*-----------------------------------*/
    /*------------ 监听id变化 ------------*/
    /*-----------------------------------*/
    id_recorder = document.getElementById("current_continent_id");
    // 创建一个 MutationObserver 实例
    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
          if (mutation.type === 'childList' || mutation.type === 'subtree') {
              // 当 innerHTML 变化时执行的函数
              handleChange();
          }
        }
    });
    // 配置观察选项
    const config = {
      childList: true, // 观察子节点的变化
      subtree : true,   // 观察所有后代节点
    };
    // 启动观察
    observer.observe(id_recorder, config);
    // 定义变化时执行的函数
    function handleChange() {
      // console.log('innerHTML has changed:', id_recorder.innerHTML);
      UpdateChart();
    }
    // 在页面关闭时停止观察
    window.addEventListener('beforeunload', () => {
      observer.disconnect();
    });
})();
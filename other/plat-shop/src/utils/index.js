import QQMapWX from './qqmap-wx-jssdk.js';
import msg from './toast';

const QQMap = new QQMapWX({
  key: 'BZMBZ-OKXRU-DINVZ-2SRN5-4KWJ7-S6B6O'
})

//线上地址
// const baseUrl = 'https://stunnercustomer.uupt.com';
//光明地址
const baseUrl = 'http://192.168.6.180:8060';
//海涛
// const baseUrl = 'http://192.168.6.156:50654';

const commonHeader = _ => {
  //headers每次必传数据存放位置
  return {
    v: '1.1.8.3',
    appid: '11',
    token: wx.getStorageSync('loginInfo').Token || '',
    qrcode: wx.setStorageSync('scene', this.scene) || ''
  }
}

//get数据请求
const get = (opt = {}) => {
  let time = new Date().getTime();
  const str = Object.entries(opt.params).map(e => `${e[0]}=${e[1]}`).join("&").replace(/\s/g, '');
  let editHeaders = Object.assign({}, { 'content-type': 'application/json' }, commonHeader())
  opt.headers && (editHeaders = Object.assign({}, editHeaders, opt.headers))
  return new Promise((resolve, reject) => {
    let address = str ? `${opt.url}?${str}&t=${time}` : `${url}?t=${time}`;
    wx.request({
      url: baseUrl + address,
      header: editHeaders,
      method: "GET",
      success: res => {
        setTimeout(_ => {
          resolve(res.data)
        }, 0)
      },
      fail: err => {
        reject(err);
      }
    })
  })
}

//post数据请求
const post = (opt = {}) => {
  let time = new Date().getTime();
  let editHeaders = Object.assign({}, { 'content-type': 'application/json' }, commonHeader())
  opt.headers && (editHeaders = Object.assign({}, editHeaders, opt.headers))
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseUrl}${opt.url}?t=${time}`,
      data: opt.data || {},
      header: editHeaders,
      method: "POST",
      success: res => {
        setTimeout(_ => {
          if (res.data.State == 1) {
            //返回正常的数据
            resolve(res.data)
          } else if (res.data.State == -10) {
            //针对token失效问题
            //调用wxLogin接口
            wxLogin()
            resolve(res.data)
          } else if (res.data.State == -1010) {
            //跑腿地址同步
            resolve(res.data)
          } else if (res.data.State == -13) {
            //订单提交页商品状态码
            resolve(res.data)
          } else {
            //抛出异常
            reject(res.data)
          }
        }, 0)
      },
      fail: err => {
        reject(err)
      }
    })
  })
}

//地理位置获取
const qqMapInfo = none => {
  return new Promise((resolve, reject) => {
    if(none == undefined){
      wx.showLoading({
        title: '加载中',
        mask: true,
      })
    }
    //在进入小程序之前做删除之前缓存操作
    wx.getStorageSync('shopInfo')&&wx.removeStorageSync('shopInfo');
    wx.getStorageSync('QQmap')&&wx.removeStorageSync('QQmap');
    wx.getLocation({
      type: 'wgs84',
      success: res => {
        QQMap.reverseGeocoder({
          location: {
            latitude: res.latitude,
            longitude: res.longitude
          },
          success: ok => {
            //城市 经纬度
            let pos = {
              city: ok.result.address_component.city,
              latitude: res.latitude,
              longitude: res.longitude,
              mapGet: true
            }
            wx.setStorageSync('QQmap', pos)
            //调用wxLogin接口
            wxLogin().then(res => {
              resolve(res)
            }).catch(err => {
              reject(err)
            })
          },
          fail: err => {
            wx.hideLoading();
            reject(err);
          }
        })
      },
      fail: err => {
        wx.hideLoading();
        //无定位判断
        if(wx.getStorageSync('QQmap')&&!wx.getStorageSync('QQmap').mapGet){
          reject('位置信息获取失败，启用无定位搜索');
        }else{
          wx.getSetting({
            success: ok => {
              if(!(ok.authSetting['scope.userLocation'])){
                //小程序位置信息权限关闭
                console.log('小程序定位未开启')
                model(1);
              }else{
                console.log('手机定位未开启')
                model(2);
              }
            },
            fail: error => {
                console.log('权限获取失败')
            }
          })
          reject('位置信息获取失败');
        }
      }
    })
  })
}

//全局wxLogin token获取
const wxLogin = _ => {
  // 调用登录接口
  return new Promise((resolve, reject) => {
    wx.login({
      success: res => {
        userLogin(res.code).then(res => {
          if (res.State == 1) {
            wx.hideLoading()
            if (wx.getStorageSync('loginInfo')) {
              wx.removeStorageSync('loginInfo');
            }
            wx.setStorageSync('loginInfo', res.Body)
            resolve(res)
          } else if (res.State == -10) {
            wxLogin()
          }
        }).catch(err => {
          wx.hideLoading();
          msg(err.Msg);
          reject(err);
        })
      },
      fail: err => {
        wx.hideLoading();
        console.log(err);
      }
    })
  })
}

const userLogin = async code => {
  return await post({
    url: '/api/Customer/Login/WxJsCodeLogin',
    data: {
      jsCode: code,
    }
  })
}

// 营业时间格式化 示例：'0-140,180-300' => ['00:00-02:20','03:00-05:00']
// 返回一个数组，使用的时候直接String转化为字符串，做相应操作
const openTime = str => {
  const two = n => {
    return n < 10 ? '0' + n : '' + n;
  }
  if (str.indexOf(',') > -1) {
    return str.split(',').map(e => {
      let a = two(Math.floor(e.split('-')[0] / 60))
      let b = two(Math.floor(e.split('-')[0] % 60))
      let c = two(Math.floor(e.split('-')[1] / 60))
      let d = two(Math.floor(e.split('-')[1] % 60))
      return e = `${a}:${b}-${c}:${d}`;
    })
  } else {
    let a = two(Math.floor(str.split('-')[0] / 60))
    let b = two(Math.floor(str.split('-')[0] % 60))
    let c = two(Math.floor(str.split('-')[1] / 60))
    let d = two(Math.floor(str.split('-')[1] % 60))
    return [`${a}:${b}-${c}:${d}`];
  }
}

///格式化时间  date时间对象  fmt时间格式 如yyyy/MM/dd hh:mm:ss
const FmtTime = (date, fmt) => {
  var o = {
    "M+": date.getMonth() + 1, //月份   
    "d+": date.getDate(), //日   
    "h+": date.getHours(), //小时   
    "m+": date.getMinutes(), //分   
    "s+": date.getSeconds(), //秒   
    "q+": Math.floor((date.getMonth() + 3) / 3), //季度   
    "S": date.getMilliseconds() //毫秒   
  };
  if (/(y+)/.test(fmt))
    fmt = fmt.replace(RegExp.$1, (date.getFullYear() + "").substr(4 - RegExp.$1.length));
  for (var k in o)
    if (new RegExp("(" + k + ")").test(fmt))
      fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
  return fmt;
}

//获取地理位置信息
const getLoc = _ => {
  return new Promise((resolve, reject) => {
    wx.getStorageSync('QQmap')&&wx.removeStorageSync('QQmap');
    wx.getLocation({
      type: 'wgs84',
      success: res => {
        QQMap.reverseGeocoder({
          location: {
            latitude: res.latitude,
            longitude: res.longitude
          },
          success: ok => {
            //城市 经纬度
            let pos = {
              city: ok.result.address_component.city,
              latitude: res.latitude,
              longitude: res.longitude,
              mapGet: true
            }
            wx.setStorageSync('QQmap', pos)
            resolve(wx.getStorageSync('QQmap'))
          },
          fail: error => {
            reject(error)
          }
        })
      },
      fail: err => {
        reject('位置信息获取失败')
      }
    })
  })
}

//获取线上图片生成本地临时路径
const downImg = val => {
  return new Promise((resolve, reject) => {
    if (val.indexOf('wxfile://') == -1) {
      wx.downloadFile({
        url: val,
        success: res => {
          resolve(res.tempFilePath)
        },
        fail: err => {
          reject(err)
        }
      })
    } else {
      resolve(val)
    }
  })
}

//地理位置授权
const model = val => {
  wx.showModal({
    title: '定位失败',
    content: `未获取到你的地理位置，请检查${val==1?'小程序':'微信APP'}是否已关闭定位权限，或尝试重新打开小程序`,
    // showCancel:false,
    success: res => {
      if (res.confirm) {
        console.log('用户点击确定')
        if(val==1){
          wx.redirectTo({
            url: '/pages/wx-auth/main?type=1'
          })
        }
        wxLogin().then(res => {
          resolve(res)
        }).catch(err => {
          reject(err)
        })
      } else if (res.cancel) {
        console.log('用户点击取消')
        // model(val);
        //调用wxLogin接口
        wxLogin().then(res => {
          resolve(res)
        }).catch(err => {
          reject(err)
        })
      }
    }
  })
}

//获取用户信息授权
const loginModel = _ => {
  wx.showModal({
    title: '提示',
    content: '需要您重新授权',
    // showCancel:false,
    success: res => {
      if (res.confirm) {
        console.log('用户点击确定')
        wx.redirectTo({
          url: '/pages/wx-auth/main?type=2'
        })
      } else if (res.cancel) {
        console.log('用户点击取消')
        loginModel();
      }
    }
  })
}

//保存到相册授权
const phModel = _ => {
  wx.showModal({
    title: '提示',
    content: '需要您重新授权',
    // showCancel:false,
    success: res => {
      if (res.confirm) {
        console.log('用户点击确定')
        wx.navigateTo({
          url: '/pages/wx-auth/main?type=3'
        })
      } else if (res.cancel) {
        console.log('用户点击取消')
        phModel();
      }
    }
  })
}

//上传formId
const uploadFormId = formId =>{
  return post({
    url: '/api/Customer/Common/UpdateUserFormId',
    data: {
      FormId: formId
    }
  })
}

export default { get, post, openTime, qqMapInfo, FmtTime, getLoc, downImg, QQMap, phModel, loginModel, wxLogin, baseUrl, uploadFormId, commonHeader};

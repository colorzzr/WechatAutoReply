// import {isRoomContact} from './src/interface/contact.js'

'use strict'
require('babel-register')
const Wechat = require('./src/wechat.js')
const ContactFunc = require('./src/interface/contact.js')
const qrcode = require('qrcode-terminal')
const fs = require('fs')
const request = require('request')

let bot
/**
 * 尝试获取本地登录数据，免扫码
 * 这里演示从本地文件中获取数据
 */
try {
  bot = new Wechat(require('./sync-data.json'))
} catch (e) {
  bot = new Wechat()
}
/**
 * 启动机器人
 */
if (bot.PROP.uin) {
  // 存在登录数据时，可以随时调用restart进行重启
  bot.restart()
} else {
  bot.start()
}
/**
 * uuid事件，参数为uuid，根据uuid生成二维码
 */
bot.on('uuid', uuid => {
  qrcode.generate('https://login.weixin.qq.com/l/' + uuid, {
    small: true
  })
  console.log('二维码链接：', 'https://login.weixin.qq.com/qrcode/' + uuid)
})
/**
 * 登录用户头像事件，手机扫描后可以得到登录用户头像的Data URL
 */
bot.on('user-avatar', avatar => {
  console.log('登录用户头像Data URL：', avatar)
})
/**
 * 登录成功事件
 */
bot.on('login', () => {
  console.log('登录成功')
  // 保存数据，将数据序列化之后保存到任意位置
  fs.writeFileSync('./sync-data.json', JSON.stringify(bot.botData))
})
/**
 * 登出成功事件
 */
bot.on('logout', () => {
  console.log('登出成功')
  // 清除数据
  fs.unlinkSync('./sync-data.json')
})
/**
 * 联系人更新事件，参数为被更新的联系人列表
 */
bot.on('contacts-updated', contacts => {
  console.log(contacts)
  console.log('联系人数量：', Object.keys(bot.contacts).length)
})
/**
 * 错误事件，参数一般为Error对象
 */
bot.on('error', err => {
  console.error('错误：', err)
})
/**
 * 如何发送消息
 */
bot.on('login', () => {
  /**
   * 演示发送消息到文件传输助手
   * 通常回复消息时可以用 msg.FromUserName
   */
  let ToUserName = 'filehelper'

  /**
   * 发送文本消息，可以包含emoji(😒)和QQ表情([坏笑])
   */
  bot.sendMsg('自动回复启动中...', ToUserName)
    .catch(err => {
      bot.emit('error', err)
    })

  
})


let connectSession = new Map();

/**
 * 如何处理会话消息
 */
bot.on('message', msg => {
  /**
   * 获取消息时间
   */
  const msgTime = msg.getDisplayTime()
  const expireTime = msg.sessionExpireTime()
  console.log(`----------${msgTime}----------`)

  /**
   * 获取消息发送者的显示名
   */

  const fromUser = bot.contacts[msg.FromUserName].getDisplayName()
  console.log("Chatter: ",fromUser)

  /**
   * 判断消息类型
   */
  switch (msg.MsgType) {
    case bot.CONF.MSGTYPE_TEXT:
      /**
       * 文本消息
       */
      console.log("msg: ",msg.Content)
      // console.log(msg)
      
      //check whether session is valid
      if(connectSession[fromUser] == undefined){
        console.log(connectSession[fromUser])
        //create seesion expire time
        connectSession[fromUser] = expireTime

        //send auto reply to user
        const contactUser = bot.contacts[msg.FromUserName]
        const isRC = ContactFunc.isRoomContact(contactUser)
        // console.log(contactUser)
        console.log("isRoomContact: ", isRC)
        
        if (isRC === false){
          const autoReturnMsg = 
                              '-----以下消息为自动回复-----\n' + 
                              ' 对不起，由于程序员正在尝试\n' +
                              ' 续命，猛男会稍后进行回复请\n' +
                              ' 谅解有急事请连续轰炸或\n' +
                              ' 转qq575875831,谢谢!\n';
          bot.sendMsg(autoReturnMsg, msg.FromUserName)
          .catch(err => {
            bot.emit('error', err)
          })

          // console.log("Reply")
        }
      }else{
        console.log(connectSession[fromUser])
        //expire and resend auto msg
        if(msgTime > connectSession[fromUser]){
          connectSession[fromUser] = expireTime

          //send auto reply to user
          const contactUser = bot.contacts[msg.FromUserName]
          const isRC = ContactFunc.isRoomContact(contactUser)
          // console.log(contactUser)
          console.log("isRoomContact: ", isRC)
          
          if (isRC === false){
            const autoReturnMsg = 
                              '-----以下消息为自动回复-----\n' + 
                              ' 对不起，由于程序员正在尝试\n' +
                              ' 续命，猛男会稍后进行回复请\n' +
                              ' 谅解有急事请连续轰炸或\n' +
                              ' 转qq575875831,谢谢!\n';
            bot.sendMsg(autoReturnMsg, msg.FromUserName)
            .catch(err => {
              bot.emit('error', err)
            })

            // console.log("Reply")
          }
        }
      }
      break
    case bot.CONF.MSGTYPE_IMAGE:
      /**
       * 图片消息
       */
      console.log('图片消息，保存到本地')
      bot.getMsgImg(msg.MsgId).then(res => {
        fs.writeFileSync(`./media/${msg.MsgId}.jpg`, res.data)
      }).catch(err => {
        bot.emit('error', err)
      })
      break
    case bot.CONF.MSGTYPE_VOICE:
      /**
       * 语音消息
       */
      console.log('语音消息，保存到本地')
      bot.getVoice(msg.MsgId).then(res => {
        fs.writeFileSync(`./media/${msg.MsgId}.mp3`, res.data)
      }).catch(err => {
        bot.emit('error', err)
      })
      break
    case bot.CONF.MSGTYPE_EMOTICON:
      /**
       * 表情消息
       */
      console.log('表情消息，保存到本地')
      bot.getMsgImg(msg.MsgId).then(res => {
        fs.writeFileSync(`./media/${msg.MsgId}.gif`, res.data)
      }).catch(err => {
        bot.emit('error', err)
      })
      break
    case bot.CONF.MSGTYPE_VIDEO:
    case bot.CONF.MSGTYPE_MICROVIDEO:
      /**
       * 视频消息
       */
      console.log('视频消息，保存到本地')
      bot.getVideo(msg.MsgId).then(res => {
        fs.writeFileSync(`./media/${msg.MsgId}.mp4`, res.data)
      }).catch(err => {
        bot.emit('error', err)
      })
      break
    case bot.CONF.MSGTYPE_APP:
      if (msg.AppMsgType == 6) {
        /**
         * 文件消息
         */
        console.log('文件消息，保存到本地')
        bot.getDoc(msg.FromUserName, msg.MediaId, msg.FileName).then(res => {
          fs.writeFileSync(`./media/${msg.FileName}`, res.data)
          console.log(res.type);
        }).catch(err => {
          bot.emit('error', err)
        })
      }
      break
    default:
      break
  }
})

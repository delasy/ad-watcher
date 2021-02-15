const axios = require('axios')

function exec (method, data) {
  const url = 'https://api.telegram.org/bot' +
    `${process.env.TELEGRAM_BOT_TOKEN}/${method}`

  return axios.post(url, data)
}

function send (chatId, text, data = {}) {
  return exec('sendMessage', {
    chat_id: chatId,
    text: text,
    ...data
  })
}

module.exports = { exec, send }

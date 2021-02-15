require('dotenv').config()

const autoRia = require('./modules/auto-ria')
const redis = require('./modules/redis')
const telegram = require('./modules/telegram')

const settings = {
  locked: false,
  offset: 0
}

const users = {}

function commandUnwatch (msg, args) {
  if (args.length !== 2) {
    return telegram.send(msg.chat.id, 'Invalid unwatch command')
  }

  const userId = `u${msg.chat.id}`
  let idx = -1

  for (let i = 0; i < users[userId].length; i++) {
    if (users[userId][i].link === args[1]) {
      idx = i
      break
    }
  }

  if (idx === -1) {
    return telegram.send(msg.chat.id, 'You are not watching this link')
  }

  if (users[userId].length === 1) {
    delete users[userId]
  } else {
    users[userId].splice(idx, 1)
  }

  return telegram.send(msg.chat.id, 'Successfully stopped watching')
}

async function commandWatch (msg, args) {
  if (args.length !== 2) {
    return telegram.send(msg.chat.id, 'Invalid watch command')
  }

  let url

  try {
    url = new URL(args[1])
  } catch {
    return telegram.send(msg.chat.id, 'Invalid watch command')
  }

  if (url.hostname !== 'auto.ria.com') {
    return telegram.send(msg.chat.id, 'Invalid watch command')
  } else if (!url.pathname.includes('/search/')) {
    return telegram.send(msg.chat.id, 'Invalid watch command')
  }

  const query = await autoRia.linkToQuery(url)
  const userId = `u${msg.chat.id}`

  if (Object.prototype.hasOwnProperty.call(users, userId)) {
    for (const it of users[userId]) {
      if (it.query === query) {
        return telegram.send(
          msg.chat.id,
          'You cannot start watching same link'
        )
      }
    }
  }

  const ids = await autoRia.search(query)

  const item = {
    ids: ids,
    link: url,
    query: query,
    type: 'auto_ria'
  }

  if (!Object.prototype.hasOwnProperty.call(users, userId)) {
    users[userId] = [item]
  } else {
    users[userId] = [...users[userId], item]
  }

  return telegram.send(msg.chat.id, 'Successfully started watching')
}

function commandWatchList (msg) {
  const userId = `u${msg.chat.id}`

  if (!Object.prototype.hasOwnProperty.call(users, userId)) {
    return telegram.send(msg.chat.id, 'You are not watching any link')
  } else {
    const quantity = users[userId].length === 1
      ? '1 link'
      : `${users[userId].length} links`

    const links = users[userId].map((it, idx) => {
      return (idx + 1) + '. ' + it.link
    })

    const text = `You are watching ${quantity}\n${links.join('\n')}`

    return telegram.send(msg.chat.id, text, {
      disable_web_page_preview: true
    })
  }
}

async function polling () {
  const storedSettings = await redis.get('artb_settings')

  if (storedSettings !== null) {
    for (const key of Object.keys(settings)) {
      if (!Object.prototype.hasOwnProperty.call(storedSettings, key)) {
        continue
      }

      settings[key] = storedSettings[key]
    }
  }

  const storedUsers = await redis.get('artb_users')

  if (storedUsers !== null) {
    for (const key of Object.keys(storedUsers)) {
      users[key] = storedUsers[key]
    }
  }

  if (settings.locked) {
    return setTimeout(polling, 500)
  }

  const res = await telegram.exec('getUpdates', {
    offset: settings.offset + 1
  })

  if (res.data.ok !== true) {
    throw new Error('Something not ok...')
  }

  for (const it of res.data.result) {
    if (settings.offset < it.update_id) {
      settings.offset = it.update_id
    }

    if (typeof it.message === 'undefined') {
      continue
    }

    const msg = it.message
    const args = it.message.text.split(' ')

    switch (args[0]) {
      case '/start': {
        await commandWatchList(msg, args)
        break
      }
      case '/unwatch': {
        await commandUnwatch(msg, args)
        break
      }
      case '/watch': {
        await commandWatch(msg, args)
        break
      }
      case '/watch_list': {
        await commandWatchList(msg, args)
        break
      }
      default: {
        await telegram.send(msg.chat.id, `Unexpected command '${args[0]}'`)
      }
    }
  }

  await redis.set('artb_settings', settings)
  await redis.set('artb_users', users)

  return setTimeout(polling, 300)
}

async function main () {
  const storedSettings = await redis.get('artb_settings')

  if (storedSettings !== null) {
    for (const key of Object.keys(settings)) {
      if (!Object.prototype.hasOwnProperty.call(storedSettings, key)) {
        continue
      }

      settings[key] = storedSettings[key]
    }
  }

  settings.locked = false
  await redis.set('artb_settings', settings)

  await telegram.exec('setMyCommands', {
    commands: [
      { command: 'watch_list', description: 'watch list' },
      { command: 'watch', description: 'start watching' },
      { command: 'unwatch', description: 'stop watching' }
    ]
  })

  return polling()
}

main()

require('dotenv').config()

const { CronJob } = require('cron')

const autoRia = require('./modules/auto-ria')
const redis = require('./modules/redis')
const telegram = require('./modules/telegram')

async function watchLinks () {
  const settings = await redis.get('artb_settings')
  const users = await redis.get('artb_users')

  if (settings === null || users === null || settings.locked) {
    return
  }

  settings.locked = true
  await redis.set('artb_settings', settings)

  async function watchUser (userId) {
    async function watchQuery (idx) {
      const ids = await autoRia.search(users[userId][idx].query)
      const links = []

      for (const id of ids) {
        if (!users[userId][idx].ids.includes(id)) {
          users[userId][idx].ids = [...users[userId][idx].ids, id]
          links.push(`https://auto.ria.com/auto___${id}.html`)
        }
      }

      if (links.length === 0) {
        return
      }

      await telegram.send(
        userId.substr(1),
        `Search ${idx + 1}:\n${links.join('\n')}`,
        { disable_web_page_preview: true }
      )
    }

    const userPromises = []

    for (let i = 0; i < users[userId].length; i++) {
      userPromises.push(watchQuery(i))
    }

    await Promise.all(userPromises)
  }

  const promises = []

  for (const key of Object.keys(users)) {
    promises.push(watchUser(key))
  }

  await Promise.all(promises)

  settings.locked = false
  await redis.set('artb_settings', settings)
  await redis.set('artb_users', users)
}

const jobs = [
  { time: '*/15 * * * * *', onTick: watchLinks }
]

for (const job of jobs) {
  const cronJob = new CronJob(job.time, job.onTick)
  cronJob.start()
}

const redis = require('redis')
const { promisify } = require('util')

const client = redis.createClient(process.env.REDIS_URL)
const _get = promisify(client.get).bind(client)
const _set = promisify(client.set).bind(client)

async function get (key) {
  const val = await _get(key)
  return JSON.parse(val)
}

async function set (key, val) {
  return _set(key, JSON.stringify(val))
}

module.exports = {
  exists: promisify(client.exists).bind(client),
  get: get,
  rename: promisify(client.rename).bind(client),
  set: set
}

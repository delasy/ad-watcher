const axios = require('axios')

async function linkToQuery (link) {
  const linkQuery = link.search === ''
    ? link.hash.substr(1)
    : link.search.substr(1)

  const res = await axios.get(
    'https://developers.ria.com/new_to_old' +
    `?api_key=${process.env.AUTO_RIA_API_KEY}&${linkQuery}`
  )

  return res.data.string
}

async function search (query) {
  const res = await axios.get(
    'https://developers.ria.com/auto/search/' +
    `?api_key=${process.env.AUTO_RIA_API_KEY}&${query}`
  )

  const ids = []

  for (const id of res.data.result.search_result.ids) {
    ids.push(parseInt(id))
  }

  return ids
}

module.exports = { linkToQuery, search }

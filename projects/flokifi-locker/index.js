const { getCoreAssets, } = require('../helper/tokenMapping');
const { getConfig, getCache, setCache, } = require('../helper/cache');
const { sumUnknownTokens, getLPList, } = require("../helper/cache/sumUnknownTokens");

const project = 'flokifi-locker'

const chains = {
    'ethereum': 1,
    'bsc': 56,
    'arbitrum': 42161,
    'optimism': 10,
    'polygon': 137,
    'fantom': 250,
    'avax': 43114,
    'okexchain': 66,
    'kcc': 321,
    'cronos': 25,
    'evmos': 9001,
    'dogechain': 2000
}

async function fetch(chainId) {
    const response = await getConfig(project, 'https://api.flokifi.com/tokens/vault-pairs-tvl?chainId=' + chainId);
    return response.tokensAndVaults;
}

function splitPairs(pairs) {
    let uniV3NFTHolders = [];
    const tokensAndOwners = [];
    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        if (pair.isV3) uniV3NFTHolders.push(pair.vaultAddress.toLowerCase())
        else tokensAndOwners.push([pair.tokenAddress.toLowerCase(), pair.vaultAddress]);
    }
    uniV3NFTHolders = [...new Set(uniV3NFTHolders)]; // remove duplicates
    return { tokensAndOwners, uniV3NFTHolders };
}

function tvlByChain(chain) {
    return async (_, _b, { [chain]: block }) => {
        const pairs = await fetch(chains[chain]);
        let cache = (await getCache(project, chain)) || {}
        const { tokensAndOwners, uniV3NFTHolders } = splitPairs(pairs);
        let lpList = await getLPList({ lps: tokensAndOwners.map(i => i[0]), block, chain, cache, })
        lpList = new Set([...lpList, ...getCoreAssets(chain)])
        const balances = await sumUnknownTokens({ tokensAndOwners: tokensAndOwners.filter(([token]) => lpList.has(token)), block, chain, useDefaultCoreAssets: true });
        if (uniV3NFTHolders.length)
            await unwrapUniswapV3NFTs({ balances, owners: uniV3NFTHolders, chain, block });
        await setCache(project, chain, cache)
        return balances;
    };
}

Object.keys(chains).forEach(chain => {
    module.exports[chain] = {
        tvl: tvlByChain(chain)
    }
});

module.exports.misrepresentedTokens = true
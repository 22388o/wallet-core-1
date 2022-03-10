import qs from 'qs';
import { currencyToUnit } from '@liquality/cryptoassets';

export const handlePaymentUri = async ({ dispatch, getters }, { data }) => {
  const { uri } = data;

  const parsed = new URL(uri);

  const asset = {
    ethereum: 'ETH',
    bitcoin: 'BTC',
  }[parsed.protocol.replace(':', '')];

  if (!asset) throw new Error('Unsupported payment URI');

  const address = parsed.pathname;
  const params = qs.parse(parsed.search.replace('?', ''));
  // @ts-ignore
  const value = parseFloat(params.amount || params.value);
  const unitValue = currencyToUnit(getters.cryptoassets[asset], value).toNumber();

  return dispatch('requestPermission', {
    data: {
      asset,
      method: 'chain.sendTransaction',
      args: [address, unitValue],
    },
  });
};

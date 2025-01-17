import { FeeDetails } from '@liquality/types';
import { ActionContext, rootActionContext } from '..';
import { Asset } from '../types';

export const updateFees = async (context: ActionContext, { asset }: { asset: Asset }): Promise<FeeDetails> => {
  const { commit, getters, state } = rootActionContext(context);
  const network = state.activeNetwork;
  const walletId = state.activeWalletId;
  const fees = await getters
    .client({
      network,
      walletId,
      asset,
    })
    .chain.getFees();

  commit.UPDATE_FEES({ network, walletId, asset, fees });

  return fees;
};

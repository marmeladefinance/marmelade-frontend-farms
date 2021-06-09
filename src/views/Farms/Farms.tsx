import React, { useEffect, useCallback, useState } from 'react'
import { Route, useRouteMatch } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import BigNumber from 'bignumber.js'
import { useWallet } from '@binance-chain/bsc-use-wallet'
import { provider } from 'web3-core'
import { Image, Heading, RowType, Text } from '@pancakeswap-libs/uikit'
import { BLOCKS_PER_YEAR, CAKE_PER_BLOCK, CAKE_POOL_PID } from 'config'
import FlexLayout from 'components/layout/Flex'
import Page from 'components/layout/Page'
import { useFarms, usePriceBnbBusd, usePriceCakeBusd } from 'state/hooks'
import useRefresh from 'hooks/useRefresh'
import usePersistState from 'hooks/usePersistState'
import { fetchFarmUserDataAsync } from 'state/actions'
import { QuoteToken } from 'config/constants/types'
import useI18n from 'hooks/useI18n'
import { getBalanceNumber } from 'utils/formatBalance'
import { latinise } from 'utils/latinise'
import { orderBy } from 'lodash'
import styled from 'styled-components'
import Select, { OptionProps } from 'components/Select/Select'
import SearchInput from 'components/SearchInput'
import FarmCard, { FarmWithStakedValue } from './components/FarmCard/FarmCard'
import FarmTabButtons from './components/FarmTabButtons'
import Divider from './components/Divider'
import Table from './components/FarmTable/FarmTable'
import { RowProps } from './components/FarmTable/Row'
import { DesktopColumnSchema, ViewMode } from './components/types'
import ToggleView from './components/ToggleView/ToggleView'

const ControlContainer = styled.div`
  display: flex;
  width: 100%;
  align-items: center;
  position: relative;

  justify-content: space-between;
  flex-direction: column;
  margin-bottom: 32px;

  ${({ theme }) => theme.mediaQueries.sm} {
    flex-direction: row;
    flex-wrap: wrap;
    padding: 16px 32px;
    margin-bottom: 0;
  }
`

const ViewControls = styled.div`
  flex-wrap: wrap;
  justify-content: space-between;
  display: flex;
  align-items: center;
  width: 100%;
  
  > div {
    padding: 8px 0px;
  }

  ${({ theme }) => theme.mediaQueries.sm} {
    justify-content: flex-start;
    width: auto;

    > div {
      padding: 0;
    }
  }
`
const LabelWrapper = styled.div`
  > ${Text} {
    font-size: 12px;
  }
`

const FilterContainer = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 0px;

  ${({ theme }) => theme.mediaQueries.sm} {
    width: auto;
    padding: 0;
  }
`

export interface FarmsProps {
  tokenMode?: boolean
}

const Farms: React.FC<FarmsProps> = (farmsProps) => {
  const { path } = useRouteMatch()
  const TranslateString = useI18n()
  const farmsLP = useFarms()
  const cakePrice = usePriceCakeBusd()
  const bnbPrice = usePriceBnbBusd()
  const [query, setQuery] = useState('')
  const [sortOption, setSortOption] = useState('hot')
  const { account, ethereum }: { account: string; ethereum: provider } = useWallet()
  const { tokenMode } = farmsProps;

  const dispatch = useDispatch()
  const { fastRefresh } = useRefresh()
  useEffect(() => {
    if (account) {
      dispatch(fetchFarmUserDataAsync(account))
    }
  }, [account, dispatch, fastRefresh])

  const [stakedOnly, setStakedOnly] = useState(false)
  const [viewMode, setViewMode] = usePersistState(ViewMode.TABLE, 'marmelade_farm_view')

  const activeFarms = farmsLP.filter((farm) => !!farm.isTokenOnly === !!tokenMode && farm.multiplier !== '0X')
  const inactiveFarms = farmsLP.filter((farm) => !!farm.isTokenOnly === !!tokenMode && farm.multiplier === '0X')

  const stakedOnlyFarms = activeFarms.filter(
    (farm) => farm.userData && new BigNumber(farm.userData.stakedBalance).isGreaterThan(0),
  )

  // /!\ This function will be removed soon
  // This function compute the APY for each farm and will be replaced when we have a reliable API
  // to retrieve assets prices against USD
  const farmsList = useCallback(
    (farmsToDisplay, removed: boolean) => {
      const sortFarms = (farms: FarmWithStakedValue[]): FarmWithStakedValue[] => {
        switch (sortOption) {
          case 'apr':
            return orderBy(farms, (farm: FarmWithStakedValue) => farm.apy, 'desc')
          case 'multiplier':
            return orderBy(
              farms,
              (farm: FarmWithStakedValue) => (farm.multiplier ? Number(farm.multiplier.slice(0, -1)) : 0),
              'desc',
            )
          case 'earned':
            return orderBy(
              farms,
              (farm: FarmWithStakedValue) => (farm.userData ? Number(farm.userData.earnings) : 0),
              'desc',
            )
          case 'liquidity':
            return orderBy(farms, (farm: FarmWithStakedValue) => Number(farm.lpTotalInQuoteToken), 'desc')
          default:
            return farms
        }
      }

      // const cakePriceVsBNB = new BigNumber(farmsLP.find((farm) => farm.pid === CAKE_POOL_PID)?.tokenPriceVsQuote || 0)
      let farmsToDisplayWithAPY: FarmWithStakedValue[] = farmsToDisplay.map((farm) => {
        // if (!farm.tokenAmount || !farm.lpTotalInQuoteToken || !farm.lpTotalInQuoteToken) {
        //   return farm
        // }
        const cakeRewardPerBlock = new BigNumber(farm.marmelPerBlock || 1).times(new BigNumber(farm.poolWeight)).div(new BigNumber(10).pow(18))
        const cakeRewardPerYear = cakeRewardPerBlock.times(BLOCKS_PER_YEAR)

        let apy = cakePrice.times(cakeRewardPerYear);

        const totalValue = new BigNumber(farm.lpTotalInQuoteToken || 0).times(farm.quoteTokenPrice);

        // if (farm.quoteTokenSymbol === QuoteToken.BNB) {
        //   totalValue = totalValue.times(bnbPrice);
        // }

        if (totalValue.comparedTo(0) > 0) {
          apy = apy.div(totalValue);
        }

        return { ...farm, apy }
      })

      if (query) {
        const lowercaseQuery = latinise(query.toLowerCase())
        farmsToDisplayWithAPY = farmsToDisplayWithAPY.filter((farm: FarmWithStakedValue) => {
          return latinise(farm.lpSymbol.toLowerCase()).includes(lowercaseQuery)
        })
      }

      farmsToDisplayWithAPY = sortFarms(farmsToDisplayWithAPY)

      const rowData = farmsToDisplayWithAPY.map((farm) => {
        const { quoteTokenAdresses, tokenAddresses } = farm

        // const lpLabel = farm.lpSymbol && farm.lpSymbol.split(' ')[0].toUpperCase().replace('CANDY', '')
        const lpLabel = farm.lpSymbol && farm.lpSymbol.split(' ')[0].toUpperCase()

        const row: RowProps = {
          apr: {
            value:
              farm.apy &&
              farm.apy.times(new BigNumber(100)).toNumber().toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }),
            multiplier: farm.multiplier,
            lpLabel,
            tokenAddresses,
            quoteTokenAdresses,
            cakePrice,
            originalValue: farm.apy,
          },
          farm: {
            image: farm.lpSymbol.split(' ')[0].toLocaleLowerCase(),
            label: lpLabel,
            pid: farm.pid,
          },
          earned: {
            earnings: farm.userData ? getBalanceNumber(new BigNumber(farm.userData.earnings)) : null,
            pid: farm.pid,
            account,
          },
          liquidity: { farm },
          depositFee: {
            depositFee: farm.depositFeeBP,
          },
          multiplier: {
            multiplier: farm.multiplier,
          },
          details: { ...farm, account },
        }

        return row
      })

      if (viewMode === ViewMode.TABLE) {
        const columnSchema = DesktopColumnSchema

        const columns = columnSchema.map((column) => ({
          id: column.id,
          name: column.name,
          label: column.label,
          sort: (a: RowType<RowProps>, b: RowType<RowProps>) => {
            switch (column.name) {
              case 'farm':
                return b.id - a.id
              case 'apr':
                if (a.original.apr.value && b.original.apr.value) {
                  return Number(a.original.apr.value) - Number(b.original.apr.value)
                }

                return 0
              case 'earned':
                return a.original.earned.earnings - b.original.earned.earnings
              default:
                return 1
            }
          },
          sortable: column.sortable,
        }))

        return <Table data={rowData} columns={columns} />
      }

      return farmsToDisplayWithAPY.map((farm) => (
        <FarmCard
          key={farm.pid}
          farm={farm}
          removed={removed}
          bnbPrice={bnbPrice}
          cakePrice={cakePrice}
          ethereum={ethereum}
          account={account}
        />
      ))
    },
    [bnbPrice, account, cakePrice, ethereum, viewMode, query, sortOption],
  )

  const handleChangeQuery = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value)
  }

  const handleSortOptionChange = (option: OptionProps): void => {
    setSortOption(option.value)
  }

  return (
    <Page>
      <Heading as="h1" size="lg" color="primary" mb="50px" style={{ textAlign: 'center' }}>
        {
          tokenMode ?
            TranslateString(10002, 'Stake tokens to earn MARMEL')
            :
            TranslateString(320, 'Stake LP tokens to earn MARMEL')
        }
      </Heading>
      <Heading as="h2" color="secondary" mb="50px" style={{ textAlign: 'center' }}>
        {TranslateString(10000, 'Deposit Fee will be used to buyback MARMEL')}
      </Heading>
      <ControlContainer>
        <ViewControls>
          <ToggleView viewMode={viewMode} onToggle={(mode: ViewMode) => setViewMode(mode)} />
          <FarmTabButtons stakedOnly={stakedOnly} setStakedOnly={setStakedOnly} />
        </ViewControls>
        <FilterContainer>
          <LabelWrapper>
            <Text textTransform="uppercase">{TranslateString(999, 'Sort by')}</Text>
            <Select
              options={[
                {
                  label: TranslateString(999, 'Hot'),
                  value: 'hot',
                },
                {
                  label: TranslateString(999, 'APR'),
                  value: 'apr',
                },
                {
                  label: TranslateString(999, 'Multiplier'),
                  value: 'multiplier',
                },
                {
                  label: TranslateString(999, 'Earned'),
                  value: 'earned',
                },
                {
                  label: TranslateString(999, 'Liquidity'),
                  value: 'liquidity',
                },
              ]}
              onChange={handleSortOptionChange}
            />
          </LabelWrapper>
          <LabelWrapper style={{ marginLeft: 16 }}>
            <Text textTransform="uppercase">{TranslateString(999, 'Search')}</Text>
            <SearchInput onChange={handleChangeQuery} placeholder="Search Farms" />
          </LabelWrapper>
        </FilterContainer>
      </ControlContainer>

      <div>
        <Divider />
        <FlexLayout isTableMode={viewMode === ViewMode.TABLE}>
          <Route exact path={`${path}`}>
            {stakedOnly ? farmsList(stakedOnlyFarms, false) : farmsList(activeFarms, false)}
          </Route>
          <Route exact path={`${path}/history`}>
            {farmsList(inactiveFarms, true)}
          </Route>
        </FlexLayout>
      </div>
      {/* <Image src="/images/egg/8.png" alt="illustration" width={1352} height={587} responsive /> */}
    </Page>
  )
}

export default Farms

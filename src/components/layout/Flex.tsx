import styled from 'styled-components'

const FlexLayout = styled.div<{ isTableMode: boolean }>`
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  & > * {
    min-width: 280px;
    max-width: ${({ isTableMode }) => isTableMode ? '100%' : '31.5%'};
    width: 100%;
    margin: 0 8px;
    margin-bottom: 32px;
  }
`

export default FlexLayout

// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { Activity } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ActivityVisibilityProvider } from '../lib/activityVisibility'
import { BodyPortal } from './BodyPortal'

function ActivityPortal({ active }: { active: boolean }) {
  return <Activity mode={active ? 'visible' : 'hidden'}>
    <ActivityVisibilityProvider active={active}>
      <BodyPortal><div data-testid="activity-portal">portal</div></BodyPortal>
    </ActivityVisibilityProvider>
  </Activity>
}

describe('BodyPortal activity visibility', () => {
  afterEach(cleanup)

  it('removes a body portal immediately when its preserved Activity is hidden', () => {
    const { rerender } = render(<ActivityPortal active />)
    expect(screen.getByTestId('activity-portal').parentElement).toBe(document.body)

    rerender(<ActivityPortal active={false} />)

    expect(screen.queryByTestId('activity-portal')).not.toBeInTheDocument()
  })
})

import { Spinner } from './Spinner'

export function FullScreenSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg text-label-2">
      <Spinner className="size-6" />
    </div>
  )
}

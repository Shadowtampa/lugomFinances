interface SpinnerProps {
  size?: number
}

function Spinner({ size = 20 }: SpinnerProps) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-line border-t-livre"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Carregando"
    />
  )
}

export default Spinner

/** Apelido em destaque e a descrição original pequena embaixo; sem apelido, só o título (M22). */
function TituloComApelido({ titulo, apelido }: { titulo: string; apelido?: string | null }) {
  if (!apelido) return <>{titulo}</>
  return (
    <>
      <span className="block truncate">{apelido}</span>
      <span className="block truncate text-xs text-ink-soft" title={titulo}>
        {titulo}
      </span>
    </>
  )
}

export default TituloComApelido

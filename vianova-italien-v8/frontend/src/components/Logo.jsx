// Logo officiel Vianova Academy. sm = en-tête des espaces · lg = en-tête public · xl = pied de page / connexion
export default function Logo({ size = 'sm', full = false, className = '' }) {
  return <img className={`logo-img s-${size} ${className}`} src={full ? '/logo-full.png' : '/logo.png'} alt="Vianova Academy" />;
}

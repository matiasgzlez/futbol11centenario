import { useId } from "react";
// Logos de UTN y C.A. Sarmiento redibujados en vector a partir de los originales que
// mandó el organizador, para que se vean nítidos sobre el fondo oscuro.

export function UtnLogo({ className, wordmark = true }: { className?: string; wordmark?: boolean }) {
  return <svg className={className} viewBox={wordmark ? "70 60 2420 640" : "70 60 545 640"} role="img" aria-label="UTN" fill="currentColor">
    <path d="M89 84A254 254 0 0 0 597 84H493A150 150 0 0 1 193 84Z" />
    <path d="M89 682A254 254 0 0 1 597 682H493A150 150 0 0 0 193 682Z" />
    <rect x="291" y="84" width="104" height="598" />
    <rect x="89" y="331" width="508" height="104" />
    {wordmark && <>
      <rect x="723" y="70" width="11" height="618" />
      <path d="M826 78H937V412C937 520 980 590 1088 590S1240 520 1240 412V78H1350V420C1350 590 1250 687 1088 687S826 590 826 420Z" />
      <path d="M1386 78H1894V173H1696V678H1585V173H1386Z" />
      <path d="M1936 78H2026L2357 484V78H2467V678H2375L2046 273V678H1936Z" />
    </>}
  </svg>;
}

export function CasShield({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const outer = "M100 4C135 4 168 14 196 30C196 110 162 170 100 206C38 170 4 110 4 30C32 14 65 4 100 4Z";
  const inner = "M100 13C131 13 160 21 187 35C187 107 156 161 100 194C44 161 13 107 13 35C40 21 69 13 100 13Z";
  return <svg className={className} viewBox="0 0 200 210" role="img" aria-label="Club Atlético Sarmiento">
    <defs>
      <linearGradient id={`g${uid}`} x1="0" x2="1"><stop offset="0" stopColor="#e6b800" /><stop offset=".5" stopColor="#fff04a" /><stop offset="1" stopColor="#d9a800" /></linearGradient>
      <linearGradient id={`r${uid}`} x1="0" x2="1"><stop offset="0" stopColor="#c40f14" /><stop offset=".5" stopColor="#f2525a" /><stop offset="1" stopColor="#c40f14" /></linearGradient>
      <clipPath id={`c${uid}`}><path d={inner} /></clipPath>
    </defs>
    <path d={outer} fill={`url(#g${uid})`} />
    <path d={inner} fill={`url(#r${uid})`} />
    <g clipPath={`url(#c${uid})`} fill={`url(#g${uid})`}>
      {[[20, 38], [62, 87], [112, 136], [160, 180]].map(([a, b]) => <rect key={a} x={a} y="77" width={b - a} height="140" />)}
    </g>
    <text x="100" y="70" textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="40" fill="#ffe81a" letterSpacing="1">C·A·S</text>
  </svg>;
}

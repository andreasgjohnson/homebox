import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { ReactNode } from 'react';

export default function Root({ children }: { children: ReactNode }) {
  const { bodyAttributes, bodyNodes, headNodes, htmlAttributes } = useServerDocumentContext();

  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..500&family=Hanken+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body { background: #f6f2ea; }
              @keyframes breatheSoft { 0%,100% { opacity:.3; } 50% { opacity:.58; } }
              @keyframes haze { 0%,100% { opacity:.45; transform:scale(1); } 50% { opacity:.82; transform:scale(1.06); } }
              @keyframes caret { 0%,100% { opacity:1; } 50% { opacity:0; } }
              @keyframes twinkle { 0%,100% { opacity:.2; } 50% { opacity:.9; } }
              @keyframes rise { 0% { transform:translateY(0); opacity:0; } 20% { opacity:1; } 100% { transform:translateY(-300px); opacity:0; } }
              @keyframes pulseRing { 0% { transform:scale(.86); opacity:.55; } 100% { transform:scale(1.5); opacity:0; } }
              @keyframes swirl { 0% { transform:rotate(0deg) scale(1.05); } 100% { transform:rotate(360deg) scale(1.05); } }
              @keyframes swirlRev { 0% { transform:rotate(0deg) scale(1.1); } 100% { transform:rotate(-360deg) scale(1.1); } }
              @keyframes drift { 0%,100% { transform:translate(0,0) scale(1.04); } 50% { transform:translate(2%,-2%) scale(1.1); } }
              @keyframes nebulaPulse { 0%,100% { opacity:.55; } 50% { opacity:.85; } }
              @media (prefers-reduced-motion: reduce) {
                * { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
              }
            `,
          }}
        />
        <ScrollViewStyleReset />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}

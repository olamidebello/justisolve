import './globals.css';
import {MobileAppLink} from './mobile-install';
export const metadata={metadataBase:new URL('https://justisolve.com'),manifest:'/manifest.webmanifest',appleWebApp:{capable:true,title:'JustiSolve',statusBarStyle:'default'},title:'JustiSolve',description:'JustiSolve — Intelligent Solutions. Fairer Justice. AI-assisted court, litigation, evidence and legal case management',icons:{icon:'/justisolve-logo.png',apple:'/mobile/icon-192.png'},openGraph:{title:'JustiSolve',description:'Intelligent Solutions. Fairer Justice.',images:['/justisolve-logo.png']}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><MobileAppLink/>{children}</body></html>}

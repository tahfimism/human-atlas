import {createRoot} from 'react-dom/client';
import {injectSpeedInsights} from '@vercel/speed-insights';
import Home from '../app/page';
import '../app/globals.css';

injectSpeedInsights();
createRoot(document.getElementById('root')!).render(<Home/>);

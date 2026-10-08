import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell } from './shell/AppShell';
import './studio.css';

const host=document.querySelector<HTMLDivElement>('#app');
if (!host) throw new Error('CompatibilizaBIM renderer host not found.');
createRoot(host).render(<React.StrictMode><AppShell /></React.StrictMode>);

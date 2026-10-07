import React from 'react';

type ButtonProps=React.ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'ghost'|'danger'};
export function Button({variant='secondary',className='',...props}:ButtonProps){
  return <button {...props} className={`ui-button ui-button--${variant} ${className}`.trim()}/>;
}
export function Card({title,children}:React.PropsWithChildren<{title?:string}>){
  return <section className="ui-card">{title&&<h2>{title}</h2>}{children}</section>;
}
export function Status({children,tone='neutral'}:React.PropsWithChildren<{tone?:'neutral'|'success'|'warning'|'danger'}>){
  return <span className={`ui-status ui-status--${tone}`}>{children}</span>;
}
export function EmptyState({title,description}: {title:string;description:string}){
  return <div className="ui-empty"><strong>{title}</strong><p>{description}</p></div>;
}

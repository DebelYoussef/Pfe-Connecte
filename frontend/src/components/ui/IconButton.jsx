import Tooltip from './Tooltip'
export default function IconButton({ label, tooltip=label, children, className='', ...props }) { return <Tooltip content={tooltip}><button type="button" className={`icon-button interactive ${className}`} aria-label={label} {...props}>{children}</button></Tooltip> }

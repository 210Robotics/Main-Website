"use client";

import Image from "next/image";
import { Expand, X } from "lucide-react";
import { useState } from "react";
import type { PublicMedia } from "@/lib/content";

export function MediaGallery({items,limit}:{items:PublicMedia[];limit?:number}){const [active,setActive]=useState<PublicMedia|null>(null);const visible=limit?items.slice(0,limit):items;return <><div className="media-grid">{visible.map((item,index)=><button className={`media-tile media-tile-${index%6}`} key={item.id} onClick={()=>setActive(item)}><Image src={item.url} alt={item.alt} fill sizes="(max-width: 700px) 100vw, 40vw" className="object-cover transition duration-500 group-hover:scale-105"/><div className="media-overlay"><span><strong>{item.album}</strong>{item.caption&&<small>{item.caption}</small>}</span><Expand size={18}/></div></button>)}</div>{active&&<div className="lightbox" role="dialog" aria-modal="true" aria-label={active.alt} onClick={()=>setActive(null)}><button className="lightbox-close" aria-label="Close image"><X/></button><div className="relative h-[78vh] w-[92vw] max-w-6xl" onClick={(event)=>event.stopPropagation()}><Image src={active.url} alt={active.alt} fill sizes="92vw" className="object-contain"/></div><p className="mt-4 text-sm text-[#ccc]">{active.caption||active.album}</p></div>}</>}

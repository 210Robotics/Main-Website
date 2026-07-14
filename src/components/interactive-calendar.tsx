"use client";

import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, MapPin, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { CalendarEvent } from "@/lib/calendar";

const zone = "America/Chicago";
function monthKey(date: Date){return new Intl.DateTimeFormat("en-US",{timeZone:zone,year:"numeric",month:"2-digit"}).format(date)}
function sameMonth(iso:string, focus:Date){return monthKey(new Date(iso))===monthKey(focus)}
function displayDate(event:CalendarEvent){return new Intl.DateTimeFormat("en-US",{timeZone:zone,weekday:"short",month:"short",day:"numeric",hour:event.allDay?undefined:"numeric",minute:event.allDay?undefined:"2-digit"}).format(new Date(event.start))}

export function InteractiveCalendar({events}:{events:CalendarEvent[]}){
  const firstFuture=events.find((event)=>new Date(event.end)>=new Date());
  const [focus,setFocus]=useState(firstFuture?new Date(firstFuture.start):new Date());
  const [selected,setSelected]=useState<CalendarEvent|null>(null);
  const visible=useMemo(()=>events.filter((event)=>sameMonth(event.start,focus)),[events,focus]);
  const label=new Intl.DateTimeFormat("en-US",{timeZone:zone,month:"long",year:"numeric"}).format(focus);
  function move(delta:number){setFocus(new Date(focus.getFullYear(),focus.getMonth()+delta,1))}
  return <div className="calendar-shell"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#333] p-5"><div><p className="eyebrow">Shared team calendar</p><h2 className="mt-3 text-2xl font-bold">{label}</h2></div><div className="flex gap-2"><button className="calendar-control" aria-label="Previous month" onClick={()=>move(-1)}><ChevronLeft/></button><button className="calendar-control !w-auto px-4" onClick={()=>setFocus(new Date())}>Today</button><button className="calendar-control" aria-label="Next month" onClick={()=>move(1)}><ChevronRight/></button></div></div><div className="min-h-[360px] divide-y divide-[#2d2d2d]">{visible.length?visible.map((event)=><button key={event.id} className="calendar-event group" onClick={()=>setSelected(event)}><span className="calendar-date">{displayDate(event)}</span><span><strong className="block text-left text-lg group-hover:text-[#fd7803]">{event.title}</strong>{event.location&&<span className="mt-2 flex items-center gap-2 text-sm text-[#888]"><MapPin size={14}/>{event.location}</span>}</span><ChevronRight className="ml-auto text-[#555] group-hover:text-[#fd7803]"/></button>):<div className="grid min-h-[360px] place-items-center p-10 text-center"><div><CalendarDays className="mx-auto text-[#fd7803]"/><h3 className="mt-5 text-xl font-bold">No public events this month.</h3><p className="mt-2 text-sm text-[#888]">Use the arrows to explore another month.</p></div></div>}</div>{selected&&<div className="calendar-detail" role="dialog" aria-modal="true" aria-label={selected.title}><button className="absolute right-4 top-4 p-2 text-[#999] hover:text-white" onClick={()=>setSelected(null)} aria-label="Close event details"><X/></button><p className="eyebrow">{displayDate(selected)}</p><h3 className="mt-5 text-3xl font-bold">{selected.title}</h3>{selected.location&&<p className="mt-4 flex items-center gap-2 text-[#bbb]"><MapPin size={16}/>{selected.location}</p>}{selected.description&&<p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[#aaa]">{selected.description}</p>}<a className="button mt-7" href={selected.googleUrl} target="_blank" rel="noreferrer">Open in Google Calendar<ExternalLink size={15}/></a></div>}</div>
}

export function CalendarPreview({events}:{events:CalendarEvent[]}){const upcoming=events.filter((event)=>new Date(event.end)>=new Date()).slice(0,3);return <div className="divide-y divide-[#333] border-y border-[#333]">{upcoming.length?upcoming.map((event)=><div className="grid gap-4 py-6 md:grid-cols-[170px_1fr_180px] md:items-center" key={event.id}><span className="font-mono text-xs font-bold uppercase text-[#fd7803]">{displayDate(event)}</span><div><h3 className="text-xl font-bold">{event.title}</h3>{event.location&&<p className="mt-1 text-sm text-[#888]">{event.location}</p>}</div><a className="button secondary !min-h-10" href="/events">View calendar</a></div>):<div className="py-8 text-sm text-[#888]">New public events will appear here automatically from the shared calendar.</div>}</div>}

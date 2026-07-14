import type { Metadata } from "next";
import { MediaGallery } from "@/components/media-gallery";
import { PageHero, SectionHeading } from "@/components/ui";
import { getPublicMedia } from "@/lib/content";

export const metadata:Metadata={title:"Media"};
export default async function MediaPage(){const media=await getPublicMedia();return <><PageHero eyebrow="Media library" title="Inside the build." body="Meetings, design reviews, prototypes, competition preparation, and the people who make it all happen." image="/media/brand/makerspace.png"/><section className="section"><div className="shell"><SectionHeading eyebrow="Shared Drive gallery" title="Work worth seeing." body="New approved photos and MP4 videos synchronize from the 210 Robotics shared Drive and publish here automatically. HEIC, HEIF, AVIF, TIFF, GIF, JPG, PNG, and WebP photos are converted for reliable browser viewing."/><MediaGallery items={media}/></div></section></>}

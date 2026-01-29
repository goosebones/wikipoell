import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/styles/components/ui/card";
import Link from "next/link";
import Image from "next/image";
import { getGarmentCode } from "@/lib/garments";

export default function GarmentCard({ garment }) {
  const {line1: garmentCodeLine1, line2: garmentCodeLine2} = getGarmentCode(garment);
  return (
    <Link href={`/garment/${garment._id}`}>
      <Card className="gap-1 py-2">
        <div className="relative aspect-square overflow-hidden">
          {garment.images && garment.images.length > 0 && (
            <Image
              src={garment.images[0].url}
              alt={garment.title}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority={false}
            />
          )}
        </div>
        <CardHeader className="pt-2">
          <CardTitle>{garment.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription>
            <div>{garmentCodeLine1}</div>
            <div>{garmentCodeLine2}</div>
          </CardDescription>
        </CardContent>
      </Card>
    </Link>
  );
}

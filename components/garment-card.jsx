"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/styles/components/ui/card";
import Link from "next/link";
import Image from "next/image";

export default function GarmentCard({ garment }) {
  return (
    <Link href={`/garment/${garment._id}`}>
      <Card>
        <div className="relative aspect-square bg-gray-200 overflow-hidden">
          {garment.images && garment.images.length > 0 && (
            <Image
              src={"/" + garment.images[0]}
              alt={garment.title}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority={false}
            />
          )}
        </div>
        <CardHeader>
          <CardTitle>{garment.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription>
            <div>
              <div>{garment.color}</div>
              <div>{garment.material}</div>
            </div>
          </CardDescription>
        </CardContent>
      </Card>
    </Link>
  );
}

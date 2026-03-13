import { Card, CardSection, Text } from "@mantine/core";
import Link from "next/link";
import Image from "next/image";
import { getGarmentCode } from "@/lib/garments";

export default function GarmentCard({ garment }) {
  const { line1: garmentCodeLine1, line2: garmentCodeLine2 } =
    getGarmentCode(garment);
  return (
    <Link href={`/garment/${garment._id}`}>
      <Card withBorder>
        <CardSection withBorder>
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
        </CardSection>

        <Text
          fw={600}
          truncate="end"
        >
          {garment.title}
        </Text>
        <Text
          size="sm"
          c="dimmed"
          truncate="end"
        >
          {garmentCodeLine1}
        </Text>
        <Text
          size="sm"
          c="dimmed"
          truncate="end"
        >
          {garmentCodeLine2}
        </Text>
      </Card>
    </Link>
  );
}

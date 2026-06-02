"use client";

import Image from "next/image";
import { Modal } from "@mantine/core";

export default function ImageLightboxModal({ url, onClose }) {
  return (
    <Modal
      opened={!!url}
      onClose={onClose}
      size="xl"
      padding={0}
      withCloseButton={false}
      styles={{ content: { background: "#000" }, body: { padding: 0 } }}
      onClick={onClose}
    >
      {url && (
        <div
          style={{
            position: "relative",
            width: "100%",
            paddingBottom: "133%",
            background: "#000",
          }}
        >
          <Image
            src={url}
            alt="Full size"
            fill
            style={{ objectFit: "contain" }}
            sizes="80vw"
          />
        </div>
      )}
    </Modal>
  );
}

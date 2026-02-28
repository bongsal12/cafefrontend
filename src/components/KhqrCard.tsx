import Image from "next/image";
import { QRCodeCanvas } from "qrcode.react";

export function KhqrCard({
  merchantName,
  amountUsd,
  qrString,
}: {
  merchantName: string;
  amountUsd: number;
  qrString: string;
}) {
  return (
    <div className="w-full overflow-hidden rounded-3xl bg-white shadow-2xl">
      {/* Header */}
      <div className="bg-red-600 py-4 text-center text-2xl font-extrabold text-white">
        KHQR
      </div>

      {/* Merchant + Amount */}
      <div className="px-5 pt-4">
        <div className="text-sm text-gray-800 font-semibold">{merchantName}</div>
        <div className="mt-1 flex items-end gap-2">
          <div className="text-3xl font-extrabold text-black">
            {amountUsd.toFixed(2)}
          </div>
          <div className="pb-1 text-sm font-bold text-gray-700">USD</div>
        </div>
      </div>

      {/* Dotted separator */}
      <div className="my-3 border-t border-dashed border-gray-300" />

      {/* QR */}
      <div className="px-5 pb-6">
        <div className="relative mx-auto w-[260px] rounded-2xl bg-white p-3">
          <QRCodeCanvas
            value={qrString}
            size={240}
            includeMargin
            level="H" 
          />

          {/* Center logo (optional) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="rounded-full bg-white p-2 shadow">
              <Image
                src="/image/khqr.png"
                alt="KHQR"
                width={34}
                height={34}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

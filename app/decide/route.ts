import { decideUsage, handleDecide } from "@/lib/official/handler";

export const POST = (request: Request) => handleDecide(request);
export const GET = () => decideUsage();

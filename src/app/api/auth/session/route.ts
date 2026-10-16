import { getAuthContext } from "@/lib/auth/get-auth-context";
import { getUserById } from "@/services/auth-service";
import { ok, fail, handleApiError } from "@/lib/utils/api-response";

export const dynamic = "force-dynamic";

/** Used by the frontend session-bootstrap thunk on app load/reload. */
export async function GET() {
  try {
    const context = await getAuthContext();
    if (!context) {
      return fail(401, "UNAUTHENTICATED", "Not signed in.");
    }

    const user = await getUserById(context.userId);
    if (!user) {
      return fail(401, "UNAUTHENTICATED", "Not signed in.");
    }

    return ok({
      user: { id: user._id.toString(), name: user.name, email: user.email },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

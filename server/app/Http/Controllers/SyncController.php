<?php

namespace App\Http\Controllers;

use App\Models\Trade;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class SyncController extends Controller
{
    /**
     * Delta sync: apply the client's changes (last-write-wins by client updatedAt),
     * then return changes from other devices since lastPulledAt.
     */
    public function sync(Request $request)
    {
        $user = $request->user();
        $lastPulledAt = $request->input('lastPulledAt');
        $changes = $request->input('changes', []);

        $pushedIds = [];

        foreach ($changes as $c) {
            if (empty($c['id'])) {
                continue;
            }
            $pushedIds[] = $c['id'];

            $incomingUpdated = Carbon::parse($c['updatedAt'] ?? ($c['data']['updatedAt'] ?? now()));

            $existing = Trade::where('id', $c['id'])->first();
            if ($existing && (int) $existing->user_id !== (int) $user->id) {
                continue; // not this user's record
            }
            if ($existing && $existing->client_updated_at && $existing->client_updated_at->greaterThanOrEqualTo($incomingUpdated)) {
                continue; // server copy is newer or equal
            }

            Trade::updateOrCreate(
                ['id' => $c['id']],
                [
                    'user_id' => $user->id,
                    'data' => $c['data'] ?? [],
                    'deleted' => (bool) ($c['deleted'] ?? false),
                    'client_updated_at' => $incomingUpdated,
                ]
            );
        }

        $serverTime = now();

        $query = Trade::where('user_id', $user->id);
        if ($lastPulledAt) {
            $query->where('updated_at', '>', Carbon::parse($lastPulledAt));
        }
        if (! empty($pushedIds)) {
            $query->whereNotIn('id', $pushedIds);
        }

        $trades = $query->get()->map(fn ($t) => [
            'id' => $t->id,
            'data' => $t->data,
            'deleted' => $t->deleted,
            'updatedAt' => optional($t->client_updated_at)->toIso8601String(),
        ]);

        return response()->json([
            'trades' => $trades,
            'serverTime' => $serverTime->toIso8601String(),
        ]);
    }
}

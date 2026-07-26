export type ErrorLocation = {
  file: string | null;
  line: number | null;
  column: number | null;
  frame: string | null;
};

/**
 * Ambil frame stack pertama di luar node_modules (mirip ringkasan Laravel log).
 */
export function extractErrorLocation(error: unknown): ErrorLocation {
  if (!(error instanceof Error) || !error.stack) {
    return { file: null, line: null, column: null, frame: null };
  }

  const frames = error.stack.split('\n').slice(1);
  for (const raw of frames) {
    const frame = raw.trim();
    if (!frame || frame.includes('node_modules')) {
      continue;
    }

    const withParens = frame.match(/\((.+):(\d+):(\d+)\)$/);
    if (withParens) {
      return {
        file: withParens[1],
        line: Number(withParens[2]),
        column: Number(withParens[3]),
        frame,
      };
    }

    const bare = frame.match(/at (.+):(\d+):(\d+)$/);
    if (bare) {
      return {
        file: bare[1],
        line: Number(bare[2]),
        column: Number(bare[3]),
        frame,
      };
    }
  }

  return {
    file: null,
    line: null,
    column: null,
    frame: frames[0]?.trim() ?? null,
  };
}

export function serializeUnknownError(error: unknown): {
  name: string;
  message: string;
  stack: string | null;
} {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }

  return {
    name: 'NonError',
    message: typeof error === 'string' ? error : JSON.stringify(error),
    stack: null,
  };
}

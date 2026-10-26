const students = [
  { id: 1, name: "Ayesha", course: "Physics", score: 92 },
  { id: 2, name: "Rahim", course: "Math", score: 88 },
  { id: 3, name: "Nusrat", course: "Chemistry", score: 95 },
];

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Super Students</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 16px; color: #222; }
    h1 { margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
    small { color: #777; }
  </style>
</head>
<body>
  <h1>Super Students</h1>
  <small>Running on Cloudflare Workers</small>
  <table>
    <thead><tr><th>Name</th><th>Course</th><th>Score</th></tr></thead>
    <tbody id="rows"><tr><td colspan="3">Loading…</td></tr></tbody>
  </table>
  <script>
    fetch("/api/students")
      .then((r) => r.json())
      .then((list) => {
        document.getElementById("rows").innerHTML = list
          .map((s) => "<tr><td>" + s.name + "</td><td>" + s.course + "</td><td>" + s.score + "</td></tr>")
          .join("");
      });
  </script>
</body>
</html>`;

export default {
  async fetch(request) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/health") {
      return Response.json({ status: "ok", time: new Date().toISOString() });
    }

    if (pathname === "/api/students") {
      return Response.json(students);
    }

    const match = pathname.match(/^\/api\/students\/(\d+)$/);
    if (match) {
      const student = students.find((s) => s.id === Number(match[1]));
      return student
        ? Response.json(student)
        : Response.json({ error: "Student not found" }, { status: 404 });
    }

    if (pathname === "/") {
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    return new Response("Not found", { status: 404 });
  },
};

export function buildExerciseNotebook(e) {
  const md =
    "# " +
    e.title +
    "\n\n" +
    e.prompt +
    "\n\n**Objetivo** — " +
    e.objective +
    "\n\n**Entrada de exemplo**\n```\n" +
    e.input +
    "\n```\n\n**Saída esperada**\n```\n" +
    e.output +
    "\n```\n\n**Dica** — " +
    e.hint;
  return {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: { display_name: "Python 3", language: "python", name: "python3" },
      colab: { name: e.title + ".ipynb" },
    },
    cells: [
      { cell_type: "markdown", id: "enunciado", metadata: {}, source: [md] },
      {
        cell_type: "code",
        id: "pratica",
        metadata: {},
        execution_count: null,
        outputs: [],
        source: ["# Escreva sua solução aqui.\n"],
      },
    ],
  };
}

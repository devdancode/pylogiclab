import { Header, Footer } from "./common";
export function Policy({ privacy, member }: { privacy: boolean; member: boolean }) {
  return (
    <>
      <Header current="legal" member={member} />
      <main id="principal" className="wrapper legal">
        <a className="back" href="/">
          ← Início
        </a>
        <article className="panel article">
          <h1>{privacy ? "Política de privacidade" : "Termos de uso"}</h1>
          <p className="muted">LógicaLab · Versão de novembro de 2026</p>
          {privacy ? (
            <>
              <h2>Dados da matrícula</h2>
              <p>
                A coordenação do projeto de extensão utiliza os dados de identificação, contato,
                nascimento, localidade, escolaridade e experiência para organizar a turma,
                personalizar a trilha e acompanhar a participação. A área profissional, os objetivos
                e a foto são opcionais. O perfil fica visível ao próprio participante e à
                administração autorizada.
              </p>
              <h2>Registros de aprendizagem</h2>
              <p>
                O sistema registra aulas acessadas e concluídas, tempo aproximado de estudo,
                exercícios, tentativas de quiz, notas e avaliações. Relatórios acadêmicos exportados
                contêm indicadores agregados. Ao escrever feedback, evite incluir nomes, telefone ou
                outros dados identificáveis.
              </p>
              <h2>Acesso, armazenamento e serviços</h2>
              <p>
                Os registros ficam no banco relacional da plataforma. O provedor de identidade
                valida o acesso e gerencia as credenciais. Cookies necessários mantêm a sessão. Ao
                abrir o Google Colab, aplicam-se as condições do Google ao uso do caderno.
              </p>
              <h2>Controle dos seus dados</h2>
              <p>
                Em Meu perfil, você pode consultar e corrigir seus dados e excluir a matrícula com
                os registros pessoais associados. Para encaminhar uma solicitação à coordenação,
                utilize a área de feedback e indique o pedido. Os dados são usados durante o projeto
                e a análise de resultados. Após essa finalidade, a coordenação deve eliminá-los ou
                anonimizá-los.
              </p>
            </>
          ) : (
            <>
              <h2>Participação gratuita</h2>
              <p>
                A LógicaLab é um ambiente educacional de extensão em Engenharia da Computação,
                criado para estudantes e integrantes da comunidade de Pirassununga e de outras
                localidades. A participação é gratuita e voluntária.
              </p>
              <h2>Uso da conta e dos materiais</h2>
              <p>
                Mantenha suas credenciais pessoais e informe dados corretos no cadastro. Utilize as
                aulas, cadernos e avaliações para fins de aprendizagem. Respeite os demais
                participantes e a autoria dos materiais complementares.
              </p>
              <h2>Atividades e registros</h2>
              <p>
                Você estuda no próprio ritmo e pode repetir os quizzes. A plataforma registra o
                progresso para apresentar seu desempenho e produzir indicadores acadêmicos
                agregados. O uso do Colab é opcional. Você também pode executar o caderno em um
                ambiente Python compatível.
              </p>
              <h2>Encerramento</h2>
              <p>
                Você pode encerrar sua participação e excluir os dados no perfil. A coordenação pode
                desativar o acesso em caso de uso indevido. Dúvidas ou solicitações podem ser
                registradas pela área de feedback.
              </p>
            </>
          )}
          <a className="text-link" href={privacy ? "/termos" : "/privacidade"}>
            {privacy ? "Consultar termos de uso" : "Consultar política de privacidade"} →
          </a>
        </article>
      </main>
      <Footer />
    </>
  );
}

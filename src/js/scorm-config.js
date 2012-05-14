var learnername = ""; // Nome do aluno
var completed = false; // Status da AI: completada ou não
var score = 0; // Nota do aluno (de 0 a 100)
var scormExercise = 1; // Exercício corrente relevante ao SCORM
var screenExercise = 1; // Exercício atualmente visto pelo aluno (não tem relação com scormExercise)
var N_EXERCISES = 2; // Quantidade de exercícios desta AI
var scorm = pipwerks.SCORM; // Seção SCORM
scorm.version = "2004"; // Versão da API SCORM
var PING_INTERVAL = 5 * 60 * 1000; // milissegundos
var pingCount = 0; // Conta a quantidade de pings enviados para o LMS

// Inicia a AI.
$(document).ready(function(){       

  //Deixa a aba "Orientações" ativa no carregamento da atividade
  $('#exercicios').tabs({ selected: 0 });

  // Habilita/desabilita a visualização da mediatriz
  $('#exercicios').tabs({
    select: function(event, ui) {
    
      screenExercise = ui.index;
    
      if (screenExercise == 2) document.ggbApplet.setVisible('e', true);
      else document.ggbApplet.setVisible('e', false);
    }
  });

  // Sorteia as coordenadas do ponto C
  var xcoord = -2 + Math.floor(10 * Math.random());
  var ycoord =  0 + Math.floor( 6 * Math.random());
  document.ggbApplet.setCoords('C', xcoord, ycoord);

  $('#button1').button().click(evaluateExercise);
  $('#button2').button().click(evaluateExercise);
  $('#button3').button().click(reloadPage);

  
  initAI();
});

//Refresh da Página.
function reloadPage()
{
	document.getElementById("limpa").reset();
	window.location.reload() 
}

// Encerra a AI.
$(window).unload(function (){
  if (!completed) {
    save2LMS();  
    scorm.quit();
  }
});

/*
 * Inicia a AI.
 */ 
function initAI () {
 
  // Conecta-se ao LMS
  var connected = scorm.init();
  
  // A tentativa de conexão com o LMS foi bem sucedida.
  if (connected) {
  
    // Verifica se a AI já foi concluída.
    var completionstatus = scorm.get("cmi.completion_status");
    
    // A AI já foi concluída.
    switch (completionstatus) {
    
      // Primeiro acesso à AI
      case "not attempted":
      case "unknown":
      default:
        completed = false;
        learnername = scorm.get("cmi.learner_name");
        scormExercise = 1;
        score = 0;
        
        $("#completion-message").removeClass().addClass("completion-message-off");     
        break;
        
      // Continuando a AI...
      case "incomplete":
        completed = false;
        learnername = scorm.get("cmi.learner_name");
        scormExercise = parseInt(scorm.get("cmi.location"));
        score = parseInt(scorm.get("cmi.score.raw"));
        
        $("#completion-message").removeClass().addClass("completion-message-off");
        break;
        
      // A AI já foi completada.
      case "completed":
        completed = true;
        learnername = scorm.get("cmi.learner_name");
        scormExercise = parseInt(scorm.get("cmi.location"));
        score = parseInt(scorm.get("cmi.score.raw"));
        
        $("#completion-message").removeClass().addClass("completion-message-on");
        break;
    }
    
    if (isNaN(scormExercise)) scormExercise = 1;
    if (isNaN(score)) score = 0;
    
    // Posiciona o aluno no exercício da vez
    screenExercise = scormExercise;
    $('#exercicios').tabs("select", scormExercise - 1);  
    
    //---------------- Particular da AI -------------------------
    
    // Habilita/desabilita a visualização da mediatriz
    if (scormExercise == 2) document.ggbApplet.setVisible('e', true);
    else document.ggbApplet.setVisible('e', false);
    //-----------------------------------------------------------
   
    pingLMS(); 
  }
  // A tentativa de conexão com o LMS falhou.
  else {
    completed = false;
    learnername = "";
    scormExercise = 1;
    score = 0;
    log.error("A conexão com o Moodle falhou.");
  }
  
  // (Re)abilita os exercícios já feitos e desabilita aqueles ainda por fazer.
	if (completed) $('#exercicios').tabs("option", "disabled", []);
	else {
		$('#exercicios').tabs((scormExercise >= 1 ? "enable": "disable"), 1);
		$('#exercicios').tabs((scormExercise >= 2 ? "enable": "disable"), 2);
	}
  
  // (Re)abilita os exercícios já feitos e desabilita aqueles ainda por fazer.
  //if (completed) $('#exercicios').tabs("option", "disabled", []);
  //else {
  //  for (i = 0; i < N_EXERCISES; i++) {
  //    if (i < scormExercise) $('#exercicios').tabs("enable", i);
  //    else $('#exercicios').tabs("disable", i);
  //  }
  //}
}

/*
 * Salva cmi.score.raw, cmi.location e cmi.completion_status no LMS
 */ 
function save2LMS () {
  if (scorm.connection.isActive) {
  
    // Salva no LMS a nota do aluno.
    var success = scorm.set("cmi.score.raw", score);
  
    // Notifica o LMS que esta atividade foi concluída.
    success = scorm.set("cmi.completion_status", (completed ? "completed" : "incomplete"));
    
    // Salva no LMS o exercício que deve ser exibido quando a AI for acessada novamente.
    success = scorm.set("cmi.location", scormExercise);
    
    if (!success) log.error("Falha ao enviar dados para o LMS.");
  }
  else {
    log.trace("A conexão com o LMS não está ativa.");
  }
}

/*
 * Mantém a conexão com LMS ativa, atualizando a variável cmi.session_time
 */
function pingLMS () {

	scorm.get("cmi.completion_status");
	var timer = setTimeout("pingLMS()", PING_INTERVAL);
}

/*
 * Avalia a resposta do aluno ao exercício atual. Esta função é executada sempre que ele pressiona "terminei".
 */ 
function evaluateExercise (event) {

  // Avalia a nota
  var currentScore = getScore(screenExercise);
  
  // Mostra a mensagem de erro/acerto
  feedback(screenExercise, currentScore);
 
  // Atualiza a nota do LMS (apenas se a questão respondida é aquela esperada pelo LMS)
  if (!completed && screenExercise == scormExercise) {
    score = Math.max(0, Math.min(score + currentScore, 100));
    
    if (scormExercise < N_EXERCISES) {
      nextExercise();
    }
    else {
      completed = true;
      scormExercise = 1;
      save2LMS();
      scorm.quit();
    }
  }
}

/*
 * Prepara o próximo exercício.
 */ 
function nextExercise () {
  if (scormExercise < N_EXERCISES) ++scormExercise;
  
  $('#exercicios').tabs("enable", scormExercise);
}

/*
 * Avalia a nota do aluno num dado exercício.
 */ 
function getScore (exercise) {

  ans = 0;
      
  switch (exercise) {
  
    // Avalia a nota do exercício 1
    case 1:
    default:
      var angle_a = document.ggbApplet.getValueString('a');
      var angle_b = document.ggbApplet.getValueString('b');
      var c_a = $('#c_1').val().replace(',', '.');
      var c_b = $('#c_2').val().replace(',', '.');
    
      if (('a = ' + c_a + '°' == angle_a && 'b = ' + c_b + '°' == angle_b) || ('a = ' + c_b + '°' == angle_a && 'b = ' + c_a + '°' == angle_b)) {
          ans = 50;
      } else {
          ans = 0;
      }
      
      break;
      
    // Avalia a nota do exercício 2
    case 2:
   
     var b_a = $('#b').val(); 
      
      if (b_a == 'a') {
          ans = 50;
      } else {
          ans = 0;
      }    
    
      break;
  }
  
  return ans;
}

/*
 * Exibe a mensagem de erro/acerto (feedback) do aluno para um dado exercício e nota (naquele exercício).
 */ 
function feedback (exercise, score) {
                       
  switch (exercise) {

    // Feedback da resposta ao exercício 1
    case 1:
    default:
      if (score == 50) {
          $('#message1').html('<p/>Resposta correta!').removeClass().addClass("right-answer");
      } else {
          $('#message1').html('<p/>Resposta incorreta.').removeClass().addClass("wrong-answer");
      }
      
      break;
    
    // Feedback da resposta ao exercício 2
    case 2:
      if (score == 50) {
          $('#message2').html('<p/>Resposta correta!').removeClass().addClass("right-answer");
      } else {
          $('#message2').html('<p/>Resposta incorreta. O correto seria b(a) = a').removeClass().addClass("wrong-answer");
           
      }
      
      break;
  }
}


var log = {};

log.trace = function (message) {
  if(window.console && window.console.firebug){
    console.log(message);
  }
  else {
    alert(message);
  }  
}

log.error = function (message) {
  if( (window.console && window.console.firebug) || console){
    console.error(message);
  }
  else {
    alert(message);
  }
}


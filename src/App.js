import React, { useState, useEffect } from 'react';          
import { Chessboard } from 'react-chessboard';    
import { Chess } from 'chess.js';   


// Function to extract best move and evaluation from Stockfish's message
const getEvaluation = (message, turn) => {
  let result = { bestMove: "", evaluation: "" }; // Initialize with default values

  // Check for "bestmove" in the message to get the best move
  if (message.startsWith("bestmove")) {
    result.bestMove = message.split(" ")[1];
  }

  // Check for "info score" message to get the evaluation
  if (message.includes("info") && message.includes("score")) {
    const scoreParts = message.split(" ");
    const scoreIndex = scoreParts.indexOf("score") + 2; // "cp" or "mate" is two words after "score"

    if (scoreParts[scoreIndex - 1] === "cp") {
      // Extract centipawn evaluation and adjust based on turn
      let score = parseInt(scoreParts[scoreIndex], 10);
      if (turn !== "b") {
        score = -score; // Invert score if it was Black's turn
      }
      result.evaluation = `${score / 100}`; // Convert centipawns to pawns

    } else if (scoreParts[scoreIndex - 1] === "mate") {
      // Extract mate score if available
      const mateIn = parseInt(scoreParts[scoreIndex], 10);
      result.evaluation = `Mate in ${Math.abs(mateIn)}`;
    }
  }

  return result;
};

// Main App component
const App = () => {

  const [game, setGame] = useState(new Chess());
  const [stockfish, setStockfish] = useState(null);
  const [bestMove, setBestMove] = useState("");
  const [evaluation, setEvaluation] = useState(""); // State to store Stockfish's evaluation

  useEffect(() => {
    // Load Stockfish as a Web Worker once when the component mounts
    const stockfishWorker = new Worker("/js/stockfish-16.1-lite-single.js");
    setStockfish(stockfishWorker);

    return () => {
      stockfishWorker.terminate(); // Clean up the worker when the component unmounts
    };
  }, []);

  // Function to handle piece movement on the chessboard
  const onDrop = (sourceSquare, targetSquare) => {
    // Create a copy of the current game state using FEN notation
    const gameCopy = new Chess(game.fen());

    try {
      // Attempt to make the move on the game copy
      const move = gameCopy.move({
        from: sourceSquare,   // Starting square of the move
        to: targetSquare,     // Target square of the move
        promotion: 'q'        // Always promote to a queen for simplicity
      });

      // If the move is invalid, move will be null, so we return false to ignore the move
      if (move === null) {
        return false;
      }

      // If the move is valid, update the game state with the new position
      setGame(gameCopy);

      // Send the new position to Stockfish for analysis
      if (stockfish) {
        stockfish.postMessage(`position fen ${gameCopy.fen()}`); // Send the board position in FEN format
        stockfish.postMessage("go depth 15"); // Instruct Stockfish to analyze the position up to a depth of 15 moves
      }

      // Listen for Stockfish messages and update best move and evaluation
      stockfish.onmessage = (event) => {
        const { bestMove, evaluation } = getEvaluation(event.data, game.turn());
        if (bestMove) setBestMove(bestMove);
        if (evaluation) setEvaluation(evaluation);
      };

      return true; // Return true to indicate a valid move
    } catch (error) {
      // Catch and log any errors that occur during the move attempt
      console.error(error.message);
      return false; // Return false to ignore the invalid move
    }

    
  };

  // Render the component
  return (
    <div>
      <h1>Chess Game with Stockfish</h1>
      <Chessboard
        position={game.fen()}         // Set the board position based on the current game state
        onPieceDrop={onDrop}          // Attach the onDrop function to handle piece moves
        boardWidth={500}              // Set the width of the chessboard to 500 pixels
      />
      <div>
      <h3>Best Move: {bestMove || "Calculating..."}</h3>
      <h3>Evaluation: {evaluation || "Evaluating..."}</h3>
      </div>
    </div>
  );
};

export default App;
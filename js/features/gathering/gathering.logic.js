
import { state, setStatus, addResources, saveGame } from "../../core/state/store.js";
import { nodes, isAllowedElementKey } from "../../data/items/store.js";
import { sampleGeometricTruncated, sampleChunk } from "../../core/engine/rng/rng.js";

export function createGatheringSystem({ renderAll }) {
  const nodeState = Object.fromEntries(nodes.map(n => [n.id, {
    gathered: 0,
    target: 0,
    intervalId: null,
    isReady: false
  }]));

  function tickMsFor(node){
    const quick = (state.player.quickSlots ?? []).includes(node.resourceKey);
    return quick ? node.tickMsQuick : node.tickMsRegular;
  }

  function startGathering(nodeId) {
    const node = nodes.find(n => n.id === nodeId);
    const st = nodeState[nodeId];
    if (node && !isAllowedElementKey(node.resourceKey)) return;
    if (!node || !st) return;
    if (st.intervalId || st.isReady) return;

    st.gathered = 0;
    st.isReady = false;
    st.target = sampleGeometricTruncated(node.avgTarget, node.maxTarget);

    setStatus(`Gathering: ${node.label}`);

    const ms = tickMsFor(node);
    st.intervalId = setInterval(() => {
      const remaining = st.target - st.gathered;
      const gained = sampleChunk(node.maxChunk, remaining);
      st.gathered += gained;

      if (st.gathered >= st.target) {
        clearInterval(st.intervalId);
        st.intervalId = null;
        st.isReady = true;
        setStatus("Ready to collect");
        saveGame();
      }
      renderAll();
    }, ms);

    saveGame();
    renderAll();
  }

  function collectNode(nodeId) {
    const node = nodes.find(n => n.id === nodeId);
    const st = nodeState[nodeId];
    if (node && !isAllowedElementKey(node.resourceKey)) return;
    if (!node || !st || !st.isReady) return;

    addResources({ [node.resourceKey]: st.gathered });
    st.gathered = 0;
    st.target = 0;
    st.isReady = false;

    setStatus("Idle");
    saveGame();
    renderAll();
  }

  function gatherAllUnlocked(){
    nodes.forEach(n => startGathering(n.id));
  }

  function collectAllReady(){
    nodes.forEach(n => {
      const st = nodeState[n.id];
      if (st?.isReady) collectNode(n.id);
    });
  }

  function stopAllGathering(){
    for (const st of Object.values(nodeState)){
      if (st.intervalId){
        clearInterval(st.intervalId);
        st.intervalId = null;
      }
      // reset running nodes to idle (we don't resume timers on load yet)
      if (!st.isReady){
        st.gathered = 0;
        st.target = 0;
      }
    }
    setStatus("Idle");
  }

  function getNodeState(nodeId){
    return nodeState[nodeId];
  }

  return { startGathering, collectNode, gatherAllUnlocked, collectAllReady, stopAllGathering, getNodeState, tickMsFor };
}

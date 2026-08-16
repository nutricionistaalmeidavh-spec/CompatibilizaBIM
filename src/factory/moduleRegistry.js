import { calcularVigaBiapoiada, calcularInsumosConcreto, calcularVigaFlexao, calcularLajeUmaDirecao, calcularLajeDuasDirecoes, calcularPilar, calcularSapata, calcularEscada, calcularMuroArrimo } from '../index.js';
import { criarObra, adicionarEtapa, adicionarPendencia, resumoObra } from '../domain/obras.js';
import { criarRdo, registrarRdo, resumoRdo } from '../domain/rdo.js';
import { brl, brlReais, brDate, today } from './format.js';
import { criarModeloBim, detectarConflitosBim, resumirCompatibilizacao } from '../bim/compatibility.js';

export const softwareFactoryModules = Object.freeze({
  calculations: { calcularVigaBiapoiada, calcularInsumosConcreto, calcularVigaFlexao, calcularLajeUmaDirecao, calcularLajeDuasDirecoes, calcularPilar, calcularSapata, calcularEscada, calcularMuroArrimo },
  works: { criarObra, adicionarEtapa, adicionarPendencia, resumoObra },
  dailyReports: { criarRdo, registrarRdo, resumoRdo },
  presentation: { brl, brlReais, brDate, today },
  bimCompatibility: { criarModeloBim, detectarConflitosBim, resumirCompatibilizacao },
});

export function listarModulosReutilizados() {
  return [
    { id: 'calculations', origem: 'Engenharia360', destino: 'Engenharia360', status: 'ativo' },
    { id: 'works', origem: 'Engenharia360', destino: 'Engenharia360', status: 'ativo' },
    { id: 'dailyReports', origem: 'Engenharia360', destino: 'Engenharia360', status: 'ativo' },
    { id: 'presentation', origem: 'Fluxo DRE/src/utils/format.ts', destino: 'Engenharia360/src/factory/format.js', status: 'adaptado' },
    { id: 'bimCompatibility', origem: 'CompatibilizaBIM_v1.7.0/src/compatibilizabim', destino: 'Engenharia360/src/bim/compatibility.js', status: 'adaptado' },
  ];
}

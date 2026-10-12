export function garantirRdoMutavel(status) {
 if(status==='aprovado')throw new Error('RDO aprovado é imutável. Registre uma retificação em novo RDO, preservando o original.');
 return true;
}
export function garantirMedicaoTransicao(anterior,proximo) {
 if(!['rascunho','conferida','aprovada','rejeitada'].includes(proximo))throw new Error('Situação de medição inválida.');
 if(anterior==='aprovada'&&proximo!=='aprovada')throw new Error('Medição aprovada é imutável. Registre uma retificação independente.');
 if(anterior==='rejeitada'&&proximo==='aprovada')throw new Error('Medição rejeitada exige nova conferência.');
 return true;
}

const axios = require('axios')
const uuid = require('uuid')
const _ = require('lodash');
const fs = require('fs');
const listaCpfs = [{
	"CPF_ATIVOS": "",
	"GRUPO_EMPRESA": "",
	"BTS_EMAIL": "",
	"DATA_NASCIMENTO": ""
}]

async function retornarToken() {
	const url = "https://app-api.prd.quesaude.net/api/v1/auth/pf"
	const headers = {
		"content-type": "application/json"
	}
	const body = {
		"user": "",
		"pass": "",
		"x_device_id": "",
		"origin": "cognito-pf",
		"flag": "app"
	}
	try {
		const response = await axios.post(url, data = body, {
			headers: JSON.stringify(headers)
		})
		return response.data.data.access_token
	} catch (error) {
		console.log(error)
	}
}

async function lerCids() {
	const cidJson = fs.readFileSync('Cid.json', 'utf8');
	const cidObj = JSON.parse(cidJson);
	return cidObj;
}

async function gravarApp(jsonEntrada) {
	const url = "https://app-api.prd.quesaude.net/api/v1/beneficiary"
	const token = await retornarToken()
	const headers = {
		"Content-type": "application/json",
		"Authorization": `Bearer ${token}`
	}
	const body = jsonEntrada
	console.log(body)
	try {
		const response = await axios.post(url, data = body, {
			headers: headers
		})
		console.log("fez o menino " + jsonEntrada.cpf)
	} catch (error) {
		console.log(error)
		console.log("não fez o menino " + jsonEntrada.cpf)
	}
}

async function consultarProtheus(cpfList) {
	const cids = await lerCids();
	for (const item of cpfList) {
		const jsonTratado = await tratarJsonApp(item.CPF_ATIVOS, item.GRUPO_EMPRESA, item.BTS_EMAIL, item.DATA_NASCIMENTO, cids)
		await gravarApp(jsonTratado)
	}
}

async function tratarJsonApp(cpf, grupo, email, nascimento, cids) {
	const url3 = `http://cxdffk-prd-protheus.totvscloud.com.br:12181/rest_prd/api/qsaude/ManutBenef/Consulta/GrupoEmpresa?cpf_beneficiario=${cpf}`
	const response3 = await axios.get(url3, {
		headers: {
			"content-type": "application/json"
		}
	})
	const grupoEmpresa = response3.data.empresa_contrato.filter(b => b.status == "Ativo")
	const url1 = `http://cxdffk-prd-protheus.totvscloud.com.br:12181/rest_prd/api/qsaude/ManutBenef/Consulta/Beneficiario?cpf_beneficiario=${cpf}&grupo_empresa=${grupo}`
	const response1 = await axios.get(url1, {
		headers: {
			"content-type": "application/json"
		}
	})

	if (response1.data) {
		const retornoProtheus1 = response1.data
		const beneficiario_ativo = retornoProtheus1.beneficiarios.filter(b => b.cpf == cpf && b.status == "Ativo")
		const url2 = `http://cxdffk-prd-protheus.totvscloud.com.br:12181/rest_prd/api/qsaude/ManutBenef/Consulta/Planos?codigo_plano=${beneficiario_ativo[0].plano.codigo_plano}`
		const response2 = await axios.get(url2, {
			headers: {
				"content-type": "application/json"
			}
		})
		if (response2.data) {
			const retornoProtheus2 = response2.data
			const dataInicioVigencia = `${beneficiario_ativo[0].data_inclusao.substring(6,10)}-${beneficiario_ativo[0].data_inclusao.substring(3,5)}-${beneficiario_ativo[0].data_inclusao.substring(0,2)}`
			const fimLackBruto = [
				beneficiario_ativo[0].classe_carencia.filter(b => b.sequencia == "001")[0].dt_fim_carencia,
				beneficiario_ativo[0].classe_carencia.filter(b => b.sequencia == "002")[0].dt_fim_carencia,
				beneficiario_ativo[0].classe_carencia.filter(b => b.sequencia == "003")[0].dt_fim_carencia,
				beneficiario_ativo[0].classe_carencia.filter(b => b.sequencia == "004")[0].dt_fim_carencia,
				beneficiario_ativo[0].classe_carencia.filter(b => b.sequencia == "005")[0].dt_fim_carencia
			]
			const fimLackTratado = [
				`${fimLackBruto[0].substring(6,10)}-${fimLackBruto[0].substring(3,5)}-${fimLackBruto[0].substring(0,2)}`,
				`${fimLackBruto[1].substring(6,10)}-${fimLackBruto[1].substring(3,5)}-${fimLackBruto[1].substring(0,2)}`,
				`${fimLackBruto[2].substring(6,10)}-${fimLackBruto[2].substring(3,5)}-${fimLackBruto[2].substring(0,2)}`,
				`${fimLackBruto[3].substring(6,10)}-${fimLackBruto[3].substring(3,5)}-${fimLackBruto[3].substring(0,2)}`,
				`${fimLackBruto[4].substring(6,10)}-${fimLackBruto[4].substring(3,5)}-${fimLackBruto[4].substring(0,2)}`
			]
			var cptsgrupo = beneficiario_ativo[0].cid_doencas
			cptsgrupo = cptsgrupo.reduce((acc, e) => {
				acc.push({
					description: _.isEmpty(e.desc_cid) ? cids.find(a => a.BA9_CODDOE.trim() == e.cid.toUpperCase()).BA9_DOENCA.trim() : e.desc_cid,
					dateInitial: dataInicioVigencia,
					dateEnd: `${e.dt_fim_carencia.substring(6,10)}-${e.dt_fim_carencia.substring(3,5)}-${e.dt_fim_carencia.substring(0,2)}`,
					id: e.cid,
					tag: e.cid
				});
				return acc;
			}, []);

			const jsonSaida = {
				card: {
					accommodation: {
						id: uuid.v4(),
						description: retornoProtheus2.informacoes_plano_saude.desc_acomodacao
					},
					contract: {
						id: "0",
						proposalNumber: "0",
						description: grupoEmpresa[0].nomeEmpresa,
						contractor: {
							name: grupoEmpresa[0].nomeEmpresa,
							cpfCnpj: grupoEmpresa[0].cnpj
						}
					},
					coverage: {
						id: uuid.v4(),
						description: "São Paulo e Municipios"
					},
					segmentPlan: {
						id: "006",
						description: "AMBULATORIAL + HOSPITALAR COM OBSTETRICIA"
					},
					healthPlan: {
						code: beneficiario_ativo[0].plano.codigo_plano,
						description: beneficiario_ativo[0].plano.descricao_plano,
						startingDate: `${beneficiario_ativo[0].data_inclusao.substring(6,10)}-${beneficiario_ativo[0].data_inclusao.substring(3,5)}-${beneficiario_ativo[0].data_inclusao.substring(0,2)}`
					},
					cns: beneficiario_ativo[0].cartao_nacional_saude,
					ans: retornoProtheus2.informacoes_plano_saude.nr_reg_ans.trim()
				},
				address: {
					number: beneficiario_ativo[0].endereco.numero,
					zipCode: beneficiario_ativo[0].endereco.cep,
					city: beneficiario_ativo[0].endereco.descricao_municipio,
					neighborhood: beneficiario_ativo[0].endereco.bairro,
					street: beneficiario_ativo[0].endereco.logradouro,
					state: beneficiario_ativo[0].endereco.estado,
					complement: beneficiario_ativo[0].endereco.complemento
				},
				lacks: [{
						tag: "001",
						description: "ATENDIMENTOS DE URGÊNCIA E/OU EMERGÊNCIA",
						dateInitial: dataInicioVigencia,
						dateEnd: fimLackTratado[0]
					},
					{
						tag: "002",
						description: "CONSULTAS MÉDICAS E EXAMES NÃO ABRANGIDOS PELOS DEMAIS GRUPOS DE CARÊNCIA",
						dateInitial: dataInicioVigencia,
						dateEnd: fimLackTratado[1]
					},
					{
						tag: "003",
						description: "TERAPIAS E PROCEDIMENTOS NÃO ABRANGIDOS PELOS DEMAIS GRUPOS DE CARÊNCIA",
						dateInitial: dataInicioVigencia,
						dateEnd: fimLackTratado[2]
					},
					{
						tag: "004",
						description: "INTERNAÇÕES HOSP E PROCS DE ALTA COMPLEX",
						dateInitial: dataInicioVigencia,
						dateEnd: fimLackTratado[3]
					},
					{
						tag: "005",
						description: "PARTO A TERMO",
						dateInitial: dataInicioVigencia,
						dateEnd: fimLackTratado[4]
					}
				],
				cpts: cptsgrupo,
				photo: {
					name: "",
					url: "",
					expirationTime: ""
				},
				contact: {
					email: email.trim(),
					cellPhoneDDD: beneficiario_ativo[0].ddd_celular,
					cellPhoneNumber: beneficiario_ativo[0].telefone_celular,
					phoneDDD: "",
					phoneNumber: ""
				},
				appContent: {
					forYouCarousel: [],
					hasTermsToAccept: true,
					hasNotification: false,
					hasOnboarding: true
				},
				name: beneficiario_ativo[0].nome_completo,
				cardNumber: beneficiario_ativo[0].qsaude_carteirinha,
				blockDate: "",
				blockStatus: false,
				blockReason: "",
				familyId: beneficiario_ativo[0].qsaude_carteirinha.substring(0, 14),
				cpf: beneficiario_ativo[0].cpf,
				rg: "",
				birthday: nascimento,
				gender: beneficiario_ativo[0].sexo == "Feminino" ? "2" : "1", //2 FEMININO,
				type: beneficiario_ativo[0].tipo_beneficiario,
				relationshipDegree: beneficiario_ativo[0].parentesco,
				maritalStatus: beneficiario_ativo[0].estado_civil
			}

			return JSON.stringify(jsonSaida)
		}
	}
}

consultarProtheus(listaCpfs)